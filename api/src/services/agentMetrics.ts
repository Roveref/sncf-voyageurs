/**
 * Agent metrics — Observability, cost tracking, rate limiting, feedback.
 *
 * Stores every agent call with tokens, model, latency, cost estimate.
 * Provides rate limiting per user and daily budget caps.
 */

import db from "../db/database.js";
import { log } from "../utils/logger.js";

// ── Cost estimates (USD per 1M tokens, approximate) ──

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-6": { input: 15, output: 75 },
};

// ── Table auto-creation ──

function ensureTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS var_agent_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      userId TEXT,
      model TEXT,
      inputTokens INTEGER DEFAULT 0,
      outputTokens INTEGER DEFAULT 0,
      cacheHitPct INTEGER DEFAULT 0,
      toolCalls INTEGER DEFAULT 0,
      steps INTEGER DEFAULT 0,
      latencyMs INTEGER DEFAULT 0,
      estimatedCostUsd REAL DEFAULT 0,
      error TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS var_agent_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      messageId TEXT,
      userId TEXT,
      rating INTEGER NOT NULL,
      comment TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_metrics_created ON var_agent_metrics(createdAt);
    CREATE INDEX IF NOT EXISTS idx_metrics_user ON var_agent_metrics(userId);
    CREATE INDEX IF NOT EXISTS idx_feedback_session ON var_agent_feedback(sessionId);
  `);
}

let tablesReady = false;
function init() {
  if (tablesReady) return;
  try {
    ensureTables();
    tablesReady = true;
  } catch {
    // Non-critical
  }
}

// ── Metrics recording ──

export interface AgentMetric {
  sessionId: string;
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitPct: number;
  toolCalls: number;
  steps: number;
  latencyMs: number;
  error?: string;
}

export function recordMetric(m: AgentMetric): void {
  init();
  try {
    const costs = COST_PER_1M[m.model] || COST_PER_1M["claude-sonnet-4-6"];
    const estimatedCost = (m.inputTokens / 1_000_000) * costs.input + (m.outputTokens / 1_000_000) * costs.output;

    db.prepare(
      `INSERT INTO var_agent_metrics (sessionId, userId, model, inputTokens, outputTokens, cacheHitPct, toolCalls, steps, latencyMs, estimatedCostUsd, error, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      m.sessionId,
      m.userId,
      m.model,
      m.inputTokens,
      m.outputTokens,
      m.cacheHitPct,
      m.toolCalls,
      m.steps,
      m.latencyMs,
      Math.round(estimatedCost * 10000) / 10000,
      m.error || null,
      new Date().toISOString()
    );
  } catch (e) {
    log("metrics", `Failed to record metric: ${(e as Error).message}`);
  }
}

// ── Feedback ──

export function recordFeedback(
  sessionId: string,
  messageId: string | null,
  userId: string,
  rating: number,
  comment?: string
): void {
  init();
  try {
    db.prepare(
      `INSERT INTO var_agent_feedback (sessionId, messageId, userId, rating, comment, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(sessionId, messageId || null, userId, rating, comment || null, new Date().toISOString());
  } catch (e) {
    log("metrics", `Failed to record feedback: ${(e as Error).message}`);
  }
}

// ── Rate limiting ──

const OPUS_LIMIT_PER_HOUR = 20;
const REQUESTS_PER_MINUTE = 10;

export function checkRateLimit(userId: string): { allowed: boolean; reason?: string; downgradeToSonnet?: boolean } {
  init();
  try {
    // Check requests per minute
    const recentCount =
      (
        db
          .prepare(
            `SELECT COUNT(*) as cnt FROM var_agent_metrics WHERE userId = ? AND createdAt > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute')`
          )
          .get(userId) as any
      )?.cnt || 0;

    if (recentCount >= REQUESTS_PER_MINUTE) {
      return { allowed: false, reason: `Rate limit: max ${REQUESTS_PER_MINUTE} requests/minute. Retry in a moment.` };
    }

    // Check Opus usage per hour
    const opusCount =
      (
        db
          .prepare(
            `SELECT COUNT(*) as cnt FROM var_agent_metrics WHERE userId = ? AND model LIKE '%opus%' AND createdAt > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')`
          )
          .get(userId) as any
      )?.cnt || 0;

    if (opusCount >= OPUS_LIMIT_PER_HOUR) {
      return {
        allowed: true,
        downgradeToSonnet: true,
        reason: `Opus limit reached (${OPUS_LIMIT_PER_HOUR}/h). Downgrading to Sonnet.`,
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // Fail open
  }
}

// ── Aggregated stats (for dashboard / API) ──

export function getMetricsStats(periodDays: number = 7): {
  totalRequests: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  errorRate: number;
  byModel: { model: string; count: number; cost: number; avgLatency: number }[];
  byDay: { day: string; count: number; cost: number }[];
  topErrors: { error: string; count: number }[];
} {
  init();
  try {
    const total = db
      .prepare(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(estimatedCostUsd), 0) as cost,
              COALESCE(AVG(latencyMs), 0) as avgLatency,
              SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as errors
       FROM var_agent_metrics WHERE createdAt > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ? || ' days')`
      )
      .get(periodDays) as any;

    const byModel = db
      .prepare(
        `SELECT model, COUNT(*) as count, COALESCE(SUM(estimatedCostUsd), 0) as cost, COALESCE(AVG(latencyMs), 0) as avgLatency
       FROM var_agent_metrics WHERE createdAt > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ? || ' days')
       GROUP BY model ORDER BY count DESC`
      )
      .all(periodDays) as any[];

    const byDay = db
      .prepare(
        `SELECT date(createdAt) as day, COUNT(*) as count, COALESCE(SUM(estimatedCostUsd), 0) as cost
       FROM var_agent_metrics WHERE createdAt > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ? || ' days')
       GROUP BY date(createdAt) ORDER BY day DESC`
      )
      .all(periodDays) as any[];

    const topErrors = db
      .prepare(
        `SELECT error, COUNT(*) as count FROM var_agent_metrics
       WHERE error IS NOT NULL AND createdAt > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ? || ' days')
       GROUP BY error ORDER BY count DESC LIMIT 10`
      )
      .all(periodDays) as any[];

    return {
      totalRequests: total?.cnt || 0,
      totalCostUsd: Math.round((total?.cost || 0) * 100) / 100,
      avgLatencyMs: Math.round(total?.avgLatency || 0),
      errorRate: total?.cnt > 0 ? Math.round((total?.errors / total.cnt) * 100) : 0,
      byModel: byModel.map((r: any) => ({
        model: r.model,
        count: r.count,
        cost: Math.round(r.cost * 100) / 100,
        avgLatency: Math.round(r.avgLatency),
      })),
      byDay: byDay.map((r: any) => ({ day: r.day, count: r.count, cost: Math.round(r.cost * 100) / 100 })),
      topErrors: topErrors.map((r: any) => ({ error: r.error, count: r.count })),
    };
  } catch {
    return { totalRequests: 0, totalCostUsd: 0, avgLatencyMs: 0, errorRate: 0, byModel: [], byDay: [], topErrors: [] };
  }
}

// ── Feedback stats ──

export function getFeedbackStats(): { total: number; positive: number; negative: number; positivePct: number } {
  init();
  try {
    const stats = db
      .prepare(
        `SELECT COUNT(*) as total,
              SUM(CASE WHEN rating > 0 THEN 1 ELSE 0 END) as positive,
              SUM(CASE WHEN rating < 0 THEN 1 ELSE 0 END) as negative
       FROM var_agent_feedback`
      )
      .get() as any;
    return {
      total: stats?.total || 0,
      positive: stats?.positive || 0,
      negative: stats?.negative || 0,
      positivePct: stats?.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0,
    };
  } catch {
    return { total: 0, positive: 0, negative: 0, positivePct: 0 };
  }
}
