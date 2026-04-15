/**
 * Point d'entrée du backend — Express server
 *
 * Lance le serveur API, initialise la base de données,
 * branche les routes, et démarre le file watcher.
 */

import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import path from "path";
import fs from "fs";
import os from "os";
import https from "https";
import { checkDatabase } from "./db/checkDatabase.js";
import { bootServices } from "./services/serviceLifecycle.js";
import chatRoutes from "./routes/chat.js";
import summarizeRoutes from "./routes/summarize.js";
import dataRoutes from "./routes/data.js";
import scenarioRoutes from "./routes/scenarios.js";
import hydrateRoutes from "./routes/hydrate/index.js";
import configRoutes from "./routes/config.js";
import refreshRoutes from "./routes/refresh.js";
import demoRoutes from "./routes/demo.js";
import pptxRoutes from "./routes/pptx.js";
import eventsRoutes from "./routes/events.js";
import staffingRoutes from "./routes/staffing.js";
import bcsRoutes from "./routes/bcs.js";
import logosRoutes from "./routes/logos.js";
import notificationsRoutes from "./routes/notifications.js";
import authRoutes from "./routes/auth.js";
import jwt from "jsonwebtoken";
import { log, debug, warn, error, sep } from "./utils/logger.js";

const bootStart = performance.now();
const PORT = parseInt(process.env.PORT || "3001", 10);

const app = express();

// ── Middleware ──

app.use(
  compression({
    // Skip SSE responses — compression buffers chunks and breaks EventSource
    filter: (req, res) => {
      if (req.path === "/api/events" || res.getHeader("Content-Type") === "text/event-stream") {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "ws:",
          "wss:",
          ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : ["http://localhost:3000"]),
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:3000", "http://192.168.1.34:3000"];
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "10mb" }));

// ── Rate limiting ──

const userKeyGenerator = (req: express.Request) => {
  const user = (req as any).user?.username;
  if (user) return user;
  return req.ip ? ipKeyGenerator(req.ip) : "unknown";
};

const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/events" || req.path === "/health",
});
const mutationLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: { error: "Too many requests, please try again later." },
});
const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

app.use("/api", readLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/hydrate/changes", mutationLimiter);
app.use("/api/data", mutationLimiter);
app.use("/api/scenarios", mutationLimiter);
app.use("/api/staffing", mutationLimiter);
app.use("/api/chat", chatLimiter);

// ── JWT auth ──
// Set JWT_SECRET in .env to enable user authentication.
// If JWT_SECRET is not set, auth is disabled (development mode).

const JWT_SECRET = process.env.JWT_SECRET;

app.use("/api/auth", authRoutes);

if (JWT_SECRET) {
  const PUBLIC_PATHS = new Set(["/health"]);
  app.use("/api", (req, res, next) => {
    if (PUBLIC_PATHS.has(req.path)) return next();
    // Accept token from header or query param (for EventSource)
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req.query.token as string);
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      (req as any).user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  });
  log("auth", "JWT authentication enabled");
} else {
  warn("auth", "No JWT_SECRET set — all endpoints are public");
}

// ── Connection logger ──

const seenIPs = new Set<string>();
const LOCAL_IPS = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1"]);

app.use((req, _res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (!seenIPs.has(ip)) {
    seenIPs.add(ip);
    if (LOCAL_IPS.has(ip)) {
      debug("connect", `New connection from ${ip}`);
    } else {
      log("connect", `New connection from ${ip}`);
    }
  }
  next();
});

// ── Database checks ──
// Schema creation + migrations are done by `python3 scripts/init_db.py` (both real + demo).
// Here we verify tables exist and seed demo data if empty.

import { setDemoMode, getDemoDb } from "./db/database.js";
import dbInit from "./db/database.js";
import { hasDemoData, seedDemoData } from "./services/dummyData.js";
import { copyVarTables } from "./routes/demo.js";
import { updateMagrToGrade } from "../../shared/staffingConstants.js";

// Check real DB
checkDatabase();

// Load dynamic config from var_config (magrProfile → MAGR_TO_GRADE mapping)
try {
  const rows = dbInit.prepare("SELECT key, value FROM var_config WHERE category = 'magrProfile'").all() as {
    key: string;
    value: string;
  }[];
  if (rows.length > 0) {
    const mapping: Record<string, string> = {};
    for (const r of rows) {
      try {
        mapping[r.key] = JSON.parse(r.value).grade;
      } catch {
        /* skip */
      }
    }
    updateMagrToGrade(mapping);
  }
} catch {
  /* var_config may not exist yet */
}

// Check demo DB silently + auto-seed if empty
setDemoMode(true);
try {
  checkDatabase({ silent: true });
  const demoReady = hasDemoData();
  if (!demoReady) {
    copyVarTables();
    const result = seedDemoData();
    debug("server", `Demo data seeded: ${JSON.stringify(result.counts)}`);
  }
} catch (err) {
  warn("db", "Demo DB not ready:", err);
}
setDemoMode(false);

// ── Auto-restore user data if DB was recreated ──

import { userTablesEmpty, restoreUserData, startPeriodicBackup } from "./services/backup.js";

if (userTablesEmpty()) {
  const restored = restoreUserData();
  if (restored && restored.rows > 0) {
    log("backup", `Restored ${restored.rows} rows from backup`);
  }
}

// Start periodic backup (every hour)
startPeriodicBackup();

// ── Ensure upload temp directory exists ──

const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Routes ──

app.use("/api/chat", chatRoutes);
app.use("/api/summarize", summarizeRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/scenarios", scenarioRoutes);
app.use("/api/hydrate", hydrateRoutes);
app.use("/api/config", configRoutes);
app.use("/api/refresh", refreshRoutes);
app.use("/api/demo", demoRoutes);
app.use("/api/pptx", pptxRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/staffing", staffingRoutes);
app.use("/api/bcs", bcsRoutes);
app.use("/api/logos", logosRoutes);
app.use("/api/notifications", notificationsRoutes);

// Health check
// Backup endpoints
import { backupUserData, restoreUserData as restoreBackup } from "./services/backup.js";
app.get("/api/backup", (_req, res) => {
  const result = backupUserData();
  res.json({ success: true, ...result });
});
app.post("/api/backup/restore", (_req, res) => {
  const result = restoreBackup();
  res.json({ success: true, ...result });
});

// File download (for generated PPTX, etc.)
app.get("/api/download/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.resolve("uploads", filename);
  if (!filePath.startsWith(path.resolve("uploads"))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.download(filePath);
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── File watcher ──

const dataDir = path.resolve(process.env.DATA_DIR || "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  log("server", `Created data directory: ${dataDir}`);
}

bootServices();

// ── Start server ──

// ── Graceful shutdown ──

import db from "./db/database.js";

function shutdown(signal: string) {
  sep();
  log("server", `${signal} received — shutting down`);
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* ok */
  }
  try {
    db.close();
  } catch {
    /* already closed */
  }
  try {
    getDemoDb().pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* ok */
  }
  try {
    getDemoDb().close();
  } catch {
    /* already closed */
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── Global error handler ──

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  error("server", `Unhandled error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start server ──

app.listen(PORT, () => {
  const llm = process.env.LLM_PROVIDER || "ollama";
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  const shortDir = dataDir.replace(process.env.HOME || "", "~");
  const bootMs = Math.round(performance.now() - bootStart);

  // Resolve LAN IP from network interfaces
  const nets = Object.values(os.networkInterfaces()).flat() as os.NetworkInterfaceInfo[];
  const lanIp = nets.find((n) => n && n.family === "IPv4" && !n.internal)?.address;

  sep();
  console.log(`  Dashboard API  :  http://localhost:${PORT}`);
  if (lanIp) console.log(`  LAN access     :  http://${lanIp}:${PORT}`);
  console.log(`  Data directory :  ${shortDir}`);
  console.log(`  LLM provider  :  ${llm}${hasClaude ? " + claude (API key set)" : ""}`);
  console.log(`  Ready in ${bootMs}ms`);
  sep();

  // Fetch public IP in background (non-blocking)
  https
    .get("https://api.ipify.org", (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        if (data) console.log(`  Public IP      :  ${data}`);
      });
    })
    .on("error", () => {
      /* silent — no internet is fine */
    });
});
