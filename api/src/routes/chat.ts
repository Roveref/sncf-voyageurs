/**
 * Route /api/chat — Agent IA multi-étapes
 *
 * POST /api/chat        → Réponse classique JSON
 * POST /api/chat/stream → SSE : envoie chaque étape en temps réel
 */

import { Router, Request, Response } from "express";
import { checkHealth, getLLMProvider, CLAUDE_MODEL, getOllamaModelName, type LLMMessage } from "../services/llm.js";
import { runAgent } from "../services/agent.js";
import { recordFeedback, getMetricsStats, getFeedbackStats, checkRateLimit } from "../services/agentMetrics.js";
import { runEvalSuite } from "../services/agentEval.js";
import db from "../db/database.js";
import { log, error } from "../utils/logger.js";

const router = Router();

interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: Record<string, unknown>;
  scoringConfig?: { minAvailPct: number; minSkillsPct: number; maxGradeDist: number; periodTolerance: number };
  dashboardContext?: { activeTab: string; filters?: Record<string, unknown>; kpis?: Record<string, unknown> };
}

function getHistory(session: string): LLMMessage[] {
  const rows = db
    .prepare("SELECT role, message FROM var_aihistory WHERE session = ? ORDER BY createdAt ASC")
    .all(session) as { role: string; message: string }[];
  return rows.map((row) => ({ role: row.role as "user" | "assistant", content: row.message }));
}

function saveExchange(session: string, userMsg: string, assistantMsg: string, userId: string) {
  const now = new Date().toISOString();
  db.prepare("INSERT INTO var_aihistory (session, role, message, userId, createdAt) VALUES (?, ?, ?, ?, ?)").run(
    session,
    "user",
    userMsg,
    userId,
    now
  );
  db.prepare("INSERT INTO var_aihistory (session, role, message, userId, createdAt) VALUES (?, ?, ?, ?, ?)").run(
    session,
    "assistant",
    assistantMsg,
    userId,
    now
  );
}

// POST /api/chat/stream — SSE streaming des étapes
router.post("/stream", async (req: Request, res: Response) => {
  const { message, sessionId, scoringConfig, dashboardContext } = req.body as ChatRequest;

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "The 'message' field is required." });
    return;
  }

  const session = sessionId || crypto.randomUUID();
  const userId = (req as any).user?.username || "anonymous";
  const history = getHistory(session);

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Track client disconnect to stop agent processing
  let clientAborted = false;
  req.on("close", () => {
    clientAborted = true;
  });

  const send = (event: string, data: unknown) => {
    if (clientAborted || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("session", { sessionId: session });

  log("agent", `[stream] Question: "${message}"`);

  try {
    const result = await runAgent(
      message,
      history,
      (step) => {
        if (clientAborted) return;
        send("step", step);
      },
      scoringConfig,
      dashboardContext,
      (textDelta) => {
        if (clientAborted) return;
        send("text_delta", { text: textDelta });
      }
    );

    log("agent", `[stream] Done: ${result.toolCalls} SQL, ${result.steps.length} steps`);

    saveExchange(session, message, result.answer, userId);

    send("done", {
      reply: result.answer,
      model: getLLMProvider() === "claude" ? CLAUDE_MODEL : getOllamaModelName(),
      provider: getLLMProvider(),
      steps: result.steps.length,
    });
  } catch (err) {
    error("agent", "[stream] Error:", err);
    send("error", { error: String(err) });
  }

  res.end();
});

// POST /api/chat — Réponse classique (fallback)
router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, sessionId, scoringConfig, dashboardContext } = req.body as ChatRequest;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "The 'message' field is required." });
      return;
    }

    const session = sessionId || crypto.randomUUID();
    const userId = (req as any).user?.username || "anonymous";
    const history = getHistory(session);

    log("agent", `Question: "${message}"`);

    const result = await runAgent(message, history, undefined, scoringConfig, dashboardContext);

    log("agent", `Done: ${result.toolCalls} SQL queries, ${result.steps.length} steps`);

    saveExchange(session, message, result.answer, userId);

    res.json({
      reply: result.answer,
      sessionId: session,
      model: getLLMProvider() === "claude" ? CLAUDE_MODEL : getOllamaModelName(),
      provider: getLLMProvider(),
      toolsUsed: result.steps.filter((s) => s.type === "tool_call").map((s) => s.content),
      thinking: result.steps.filter((s) => s.type === "think").map((s) => s.content),
      steps: result.steps.length,
    });
  } catch (err) {
    error("agent", "Error:", err);
    res.status(500).json({ error: "Error communicating with AI.", details: String(err) });
  }
});

// GET /api/chat/history?sessionId=xxx
router.get("/history", (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  const userId = (req as any).user?.username || "anonymous";
  // Only return sessions owned by the current user (or legacy sessions without userId)
  const rows = db
    .prepare(
      "SELECT role, message, createdAt FROM var_aihistory WHERE session = ? AND (userId = ? OR userId IS NULL) ORDER BY createdAt ASC"
    )
    .all(sessionId, userId);
  res.json({ messages: rows });
});

// GET /api/chat/sessions
router.get("/sessions", (req: Request, res: Response) => {
  const userId = (req as any).user?.username || "anonymous";
  const rows = db
    .prepare(
      `SELECT session, MIN(createdAt) as startedAt, MAX(createdAt) as lastMessage, COUNT(*) as messageCount
     FROM var_aihistory WHERE userId = ? OR userId IS NULL GROUP BY session ORDER BY lastMessage DESC LIMIT 50`
    )
    .all(userId);
  res.json({ sessions: rows });
});

// DELETE /api/chat/cleanup — Remove sessions older than 30 days
router.delete("/cleanup", (_req: Request, res: Response) => {
  const result = db
    .prepare("DELETE FROM var_aihistory WHERE createdAt < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')")
    .run();
  res.json({ deleted: result.changes });
});

// Auto-cleanup old chat history on module load
try {
  const cleaned = db
    .prepare("DELETE FROM var_aihistory WHERE createdAt < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')")
    .run();
  if (cleaned.changes > 0) log("chat", `Cleaned ${cleaned.changes} old chat history entries`);
} catch {
  /* ignore if table doesn't exist yet */
}

// ── Feedback ──

// POST /api/chat/feedback — Rate a response (thumbs up/down)
router.post("/feedback", (req: Request, res: Response) => {
  const { sessionId, messageId, rating, comment } = req.body;
  if (!sessionId || rating === undefined) {
    res.status(400).json({ error: "sessionId and rating (-1 or 1) required" });
    return;
  }
  const userId = (req as any).user?.username || "anonymous";
  recordFeedback(sessionId, messageId || null, userId, Number(rating), comment);
  res.json({ success: true });
});

// ── Observability ──

// GET /api/chat/metrics — Agent metrics dashboard
router.get("/metrics", (_req: Request, res: Response) => {
  const days = Number(_req.query.days) || 7;
  const metrics = getMetricsStats(days);
  const feedback = getFeedbackStats();
  res.json({ metrics, feedback });
});

// ── Eval suite ──

// POST /api/chat/eval — Run evaluation suite
router.post("/eval", async (req: Request, res: Response) => {
  const { caseIds } = req.body || {};
  log("eval", `Eval requested${caseIds ? ` (${caseIds.length} cases)` : " (full suite)"}`);
  try {
    const result = await runEvalSuite(caseIds);
    res.json(result);
  } catch (err) {
    error("eval", "Eval error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/chat/health
router.get("/health", async (_req: Request, res: Response) => {
  const health = await checkHealth();
  res.status(health.ok ? 200 : 503).json(health);
});

export default router;
