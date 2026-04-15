/**
 * Agent IA — Raisonnement multi-étapes avec outils
 *
 * Deux modes selon le provider :
 * - Ollama  → JSON parsing ({"action":"sql","query":"..."})
 * - Claude  → tool_use natif (structured, fiable, multi-step)
 */

import {
  ask,
  getLLMProvider,
  askClaudeWithTools,
  askClaudeWithToolsStreaming,
  CLAUDE_MODEL,
  CLAUDE_MODEL_DEEP,
  type LLMMessage,
  type ClaudeMessage,
  type ToolUseBlock,
  type ToolResultBlock,
} from "./llm.js";
import { log } from "../utils/logger.js";
import db from "../db/database.js";
import { getSystemPrompt, getOllamaSystemPrompt, type UserProfile } from "./agentPrompt.js";
import { TOOLS } from "./agentTools.js";
import { TOOL_DISPATCH, executeSafeSQL } from "./agentDispatch.js";
import { recordMetric, checkRateLimit } from "./agentMetrics.js";
import { validateAgentOutput } from "./agentValidation.js";

// ── Types ──

interface AgentStep {
  type: "think" | "tool_call" | "tool_result" | "answer" | "action";
  content: string;
  /** Canonical tool name (set for `tool_call` steps). Used by eval grader and telemetry. */
  toolName?: string;
}

interface AgentResult {
  answer: string;
  steps: AgentStep[];
  toolCalls: number;
  suggestions?: string[];
  totalInputTokens?: number;
  totalOutputTokens?: number;
  model?: string;
  latencyMs?: number;
}

// ── Agent loop ──

const MAX_STEPS = 20;

export interface ScoringConfig {
  minAvailPct: number;
  minSkillsPct: number;
  maxGradeDist: number;
  periodTolerance: number; // 0=strict (exact), 1=moyen (±1 mois), 2=flexible (±3 mois)
}

export type OnStepCallback = (step: AgentStep) => void;
export type OnTextDeltaCallback = (text: string) => void;

export interface DashboardContext {
  activeTab: string;
  filters?: Record<string, unknown>;
  kpis?: Record<string, unknown>;
}

export async function runAgent(
  userMessage: string,
  history: LLMMessage[] = [],
  onStep?: OnStepCallback,
  scoringConfig?: ScoringConfig,
  dashboardContext?: DashboardContext,
  onTextDelta?: OnTextDeltaCallback,
  thinkingBudget?: number
): Promise<AgentResult> {
  if (getLLMProvider() === "claude") {
    return runClaudeAgent(userMessage, history, onStep, scoringConfig, dashboardContext, onTextDelta, thinkingBudget);
  }
  return runOllamaAgent(userMessage, history, onStep);
}

// ── Claude agent (native tool_use) ──

// ── Thinking budget classifier (multi-signal heuristic) ──

function classifyQuery(message: string): { budget: number; model: string } {
  let complexity = 0;

  // Signal 1: Explicit complexity patterns
  const complexPatterns = [
    /compar/i,
    /analyse/i,
    /scenario/i,
    /simulat/i,
    /impact/i,
    /what.?if/i,
    /optimis/i,
    /recommand/i,
    /strateg/i,
    /forecast/i,
    /prevision/i,
    /variance/i,
    /ecart/i,
    /tendance/i,
    /evolution/i,
    /crois/i,
    /staffing.+candidat/i,
    /qui.+affecter/i,
    /meilleur.+profil/i,
  ];
  if (complexPatterns.some((p) => p.test(message))) complexity += 2;

  // Signal 2: Multiple questions (? count)
  const questionCount = (message.match(/\?/g) || []).length;
  if (questionCount >= 3) complexity += 2;
  else if (questionCount >= 2) complexity += 1;

  // Signal 3: Temporal comparison ("vs", "entre", "avant/après", "Q1 Q2")
  if (/\bvs\b|entre.*et|avant.*apr[eè]s|Q[1-4].*Q[1-4]|trimestre.*trimestre|mois.*mois/i.test(message)) complexity += 2;

  // Signal 4: Multiple entity types referenced
  const entityTypes = [/equipe|team/i, /pipeline|deal|opp/i, /staffing|affect/i, /kpi|tu\b|bench/i].filter((p) =>
    p.test(message)
  ).length;
  if (entityTypes >= 3) complexity += 2;
  else if (entityTypes >= 2) complexity += 1;

  // Signal 5: Long message usually implies nuanced question
  if (message.length > 200) complexity += 1;

  // Route: complex queries → Opus for deeper reasoning, simple → Sonnet for speed
  if (complexity >= 5) return { budget: 50000, model: CLAUDE_MODEL_DEEP };
  if (complexity >= 3) return { budget: 35000, model: CLAUDE_MODEL_DEEP };
  if (complexity >= 1) return { budget: 25000, model: CLAUDE_MODEL };
  return { budget: 10000, model: CLAUDE_MODEL };
}

// ── User profile loading ──

function loadUserProfile(): UserProfile {
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS var_user_profile (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt TEXT NOT NULL)`
    );
    const rows = db.prepare("SELECT key, value FROM var_user_profile").all() as { key: string; value: string }[];
    const profile: UserProfile = {};
    for (const row of rows) {
      try {
        (profile as any)[row.key] = JSON.parse(row.value);
      } catch {
        (profile as any)[row.key] = row.value;
      }
    }
    return profile;
  } catch {
    return {};
  }
}

// ── Truncate tool results to avoid context overflow ──

const MAX_TOOL_RESULT_CHARS = 3000;

function truncateToolResult(result: string): string {
  if (result.length <= MAX_TOOL_RESULT_CHARS) return result;
  const lines = result.split("\n");
  const totalLines = lines.length;
  // Keep header + first lines that fit
  let truncated = "";
  for (const line of lines) {
    if ((truncated + line + "\n").length > MAX_TOOL_RESULT_CHARS - 80) break;
    truncated += line + "\n";
  }
  return truncated + `\n...(tronque, ${totalLines} lignes au total)`;
}

// ── History compression for long conversations ──

const MAX_HISTORY_MESSAGES = 20; // 10 exchanges

function compressHistory(history: LLMMessage[]): LLMMessage[] {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;
  // Keep only the last 12 messages (6 exchanges) + a summary note
  const keptMessages = history.slice(-12);
  const droppedMessages = history.slice(0, -12);
  // Extract key topics from dropped messages
  const topics = droppedMessages
    .filter((m) => m.role === "user")
    .map((m) => m.content.slice(0, 80))
    .join("; ");
  const summaryNote: LLMMessage = {
    role: "user",
    content: `[Contexte : conversation precedente portait sur : ${topics}. Seuls les 6 derniers echanges sont inclus ci-dessous.]`,
  };
  return [summaryNote, ...keptMessages];
}

// ── Inter-session memory: load recent session summaries ──

function loadRecentSessionTopics(): string {
  try {
    const sessions = db
      .prepare(
        `SELECT session, message FROM var_aihistory
       WHERE role = 'user'
       GROUP BY session
       ORDER BY MAX(createdAt) DESC
       LIMIT 3`
      )
      .all() as { session: string; message: string }[];
    if (sessions.length === 0) return "";
    const topics = sessions.map((s) => s.message.slice(0, 60)).join("; ");
    return `\n[Sujets recents de l'utilisateur : ${topics}]`;
  } catch {
    return "";
  }
}

async function runClaudeAgent(
  userMessage: string,
  history: LLMMessage[] = [],
  onStep?: OnStepCallback,
  scoringConfig?: ScoringConfig,
  dashboardContext?: DashboardContext,
  onTextDelta?: OnTextDeltaCallback,
  thinkingBudget?: number
): Promise<AgentResult> {
  const startTime = Date.now();
  const steps: AgentStep[] = [];
  let toolCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Dynamic thinking budget + model routing: complex → Opus, simple → Sonnet
  const classification = classifyQuery(userMessage);
  const budget = thinkingBudget ?? classification.budget;
  let selectedModel = classification.model;

  // Rate limit check: downgrade to Sonnet if Opus quota exceeded
  const rateCheck = checkRateLimit("default");
  if (!rateCheck.allowed) {
    return {
      answer: rateCheck.reason || "Rate limit exceeded.",
      steps: [],
      toolCalls: 0,
      model: selectedModel,
      latencyMs: Date.now() - startTime,
    };
  }
  if (rateCheck.downgradeToSonnet) {
    selectedModel = CLAUDE_MODEL;
    log("agent", `Opus limit reached, downgrading to Sonnet`);
  }

  const emit = (step: AgentStep) => {
    steps.push(step);
    onStep?.(step);
  };

  // Append context to user message
  let enrichedMessage = userMessage;

  // Dashboard context (what the user is looking at)
  if (dashboardContext) {
    const tabNames: Record<string, string> = {
      "/pipeline": "Pipeline",
      "/bookings": "Bookings",
      "/staffing": "Staffing",
      "/projet": "Project",
    };
    const tab = tabNames[dashboardContext.activeTab] || dashboardContext.activeTab;
    enrichedMessage += `\n\n[Contexte : l'utilisateur consulte l'onglet ${tab}.`;
    if (dashboardContext.filters && Object.keys(dashboardContext.filters).length > 0) {
      enrichedMessage += ` Filtres actifs : ${JSON.stringify(dashboardContext.filters)}.`;
    }
    if (dashboardContext.kpis && Object.keys(dashboardContext.kpis).length > 0) {
      enrichedMessage += ` KPIs visibles : ${JSON.stringify(dashboardContext.kpis)}.`;
    }
    // Active scenario context
    const scenario = (dashboardContext as any).activeScenario;
    if (scenario) {
      enrichedMessage += ` Scenario actif : "${scenario.name}" (${scenario.overrideCount} override${scenario.overrideCount > 1 ? "s" : ""}).`;
    }
    // Selected opportunities
    const selOpps = (dashboardContext as any).selectedOpportunities;
    if (selOpps && selOpps.length > 0) {
      enrichedMessage += ` Opportunites selectionnees : ${selOpps.map((o: any) => `${o.name} (${o.account})`).join(", ")}.`;
    }
    // Focused employee
    const focused = (dashboardContext as any).focusedEmployee;
    if (focused) {
      enrichedMessage += ` Employe en focus : ${focused.empId}${focused.jobName ? ` sur ${focused.jobName}` : ""}.`;
    }
    enrichedMessage += `]`;
  }

  // Scoring config
  if (scoringConfig) {
    const levels = ["strict", "moyen", "flexible"];
    const availLabel = levels[scoringConfig.minAvailPct] || "moyen";
    const skillsLabel = levels[scoringConfig.minSkillsPct] || "moyen";
    const gradeLabel = scoringConfig.maxGradeDist === 0 ? "exact" : `±${scoringConfig.maxGradeDist}`;
    const periodLabel = levels[scoringConfig.periodTolerance] || "moyen";
    enrichedMessage += `\n[Filtres staffing — Dispo: ${availLabel} | Competences: ${skillsLabel} | Grade: ${gradeLabel} | Periode: ${periodLabel}.]`;
  }

  const userProfile = loadUserProfile();
  const systemPrompt = getSystemPrompt(userProfile);

  // Compress history if too long + add inter-session context
  const compressedHistory = compressHistory(history);
  const sessionContext = loadRecentSessionTopics();
  if (sessionContext) enrichedMessage += sessionContext;

  const messages: ClaudeMessage[] = [
    ...compressedHistory
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: enrichedMessage },
  ];

  const SOFT_LIMIT = 12; // After this, inject a synthesis nudge

  for (let i = 0; i < MAX_STEPS; i++) {
    // Soft limit: nudge the model to synthesize if approaching step limit
    if (i === SOFT_LIMIT) {
      messages.push({
        role: "user",
        content:
          "[Systeme : tu as utilise 12/20 etapes. Si tu as assez d'informations, synthetise maintenant ta reponse finale. Sinon, fais un dernier appel outil cible.]",
      });
    }

    // Use streaming to emit text tokens in real-time (model routed by complexity)
    const response = onTextDelta
      ? await askClaudeWithToolsStreaming(systemPrompt, messages, TOOLS, onTextDelta, budget, selectedModel)
      : await askClaudeWithTools(systemPrompt, messages, TOOLS, budget, selectedModel);

    // Track token usage (including cache and thinking breakdown)
    const usage = (response as any).usage;
    if (usage) {
      totalInputTokens += usage.input_tokens || 0;
      totalOutputTokens += usage.output_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;
      const cachePct = usage.input_tokens ? Math.round((cacheRead / usage.input_tokens) * 100) : 0;
      log(
        "agent",
        `Step ${i + 1}: ${usage.input_tokens}→${usage.output_tokens} tok (${cachePct}% cached, budget ${budget}, ${selectedModel})`
      );
    }

    // Emit thinking blocks
    for (const block of response.content) {
      if (block.type === "thinking" && (block as any).thinking) {
        emit({ type: "think", content: (block as any).thinking });
      }
    }

    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as ToolUseBlock[];

    // Handle max_tokens: ask the model to continue
    if (response.stop_reason === "max_tokens" && toolUseBlocks.length === 0) {
      const partialText = textBlocks
        .map((b) => (b as any).text)
        .join("\n")
        .trim();
      messages.push({ role: "assistant", content: response.content as any });
      messages.push({
        role: "user",
        content:
          "[La reponse a ete tronquee par la limite de tokens. Continue ta reponse exactement la ou tu t'es arrete.]",
      });
      log("agent", `Step ${i + 1}: max_tokens reached, requesting continuation`);
      continue;
    }

    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      const answerText = textBlocks
        .map((b) => (b as any).text)
        .join("\n")
        .trim();
      emit({ type: "answer", content: answerText });

      // Parse structured blocks. Markers tolerate any whitespace (newline OR space)
      // after the tag — the LLM doesn't always put a newline.
      const suggestionsMatch = answerText.match(/---suggestions\s+([\s\S]*?)---/);
      if (suggestionsMatch) {
        // Prefer newline split, fall back to splitting on '?' (each follow-up is usually a question).
        const raw = suggestionsMatch[1].trim();
        let suggestions: string[];
        if (raw.includes("\n")) {
          suggestions = raw
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        } else {
          suggestions = raw
            .split(/(?<=\?)\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (suggestions.length > 0)
          emit({ type: "action", content: JSON.stringify({ action: "followups", suggestions }) });
      }
      const actionsMatch = answerText.match(/---actions\s+([\s\S]*?)---/);
      if (actionsMatch) {
        try {
          const actions = JSON.parse(actionsMatch[1].trim());
          if (actions.length > 0)
            emit({ type: "action", content: JSON.stringify({ action: "propose_actions", actions }) });
        } catch {
          /* malformed actions JSON, skip */
        }
      }
      const chartRegex = /---chart\s+([\s\S]*?)---/g;
      let chartMatch;
      while ((chartMatch = chartRegex.exec(answerText)) !== null) {
        try {
          const chart = JSON.parse(chartMatch[1].trim());
          emit({ type: "action", content: JSON.stringify({ action: "render_chart", ...chart }) });
        } catch {
          /* malformed chart JSON, skip */
        }
      }

      let cleanAnswer = answerText.replace(/---(?:suggestions|actions|chart)\s+[\s\S]*?---/g, "").trim();
      const latencyMs = Date.now() - startTime;

      // Output validation: check numbers against tool results
      const toolResultContents = steps.filter((s) => s.type === "tool_result").map((s) => s.content);
      const validation = validateAgentOutput(cleanAnswer, toolResultContents);
      if (!validation.valid && validation.warnings.length > 0) {
        cleanAnswer += `\n\n> **Avertissement** : ${validation.warnings.join(" ")}`;
        log("agent", `Validation warnings: ${validation.warnings.join("; ")}`);
      }
      log(
        "agent",
        `Done: ${totalInputTokens}→${totalOutputTokens} tok, ${toolCalls} tool call${toolCalls !== 1 ? "s" : ""}, ${latencyMs}ms, ${selectedModel}`
      );
      recordMetric({
        sessionId: "",
        userId: "default",
        model: selectedModel,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cacheHitPct: 0,
        toolCalls,
        steps: steps.length,
        latencyMs,
      });
      return {
        answer: cleanAnswer,
        steps,
        toolCalls,
        totalInputTokens,
        totalOutputTokens,
        model: selectedModel,
        latencyMs,
      };
    }

    messages.push({ role: "assistant", content: response.content as any });

    const toolResults: ToolResultBlock[] = [];
    for (const toolUse of toolUseBlocks) {
      let result: string;

      try {
        const handler = TOOL_DISPATCH[toolUse.name];
        if (!handler) {
          result = `Outil inconnu: ${toolUse.name}`;
        } else {
          const hr = await handler(toolUse.input, {
            scoringConfig,
            onProgress: onStep
              ? (msg: string) => onStep({ type: "tool_call", content: msg, toolName: toolUse.name })
              : undefined,
          });
          emit({ type: "tool_call", content: hr.description, toolName: toolUse.name });
          toolCalls++;
          result = hr.result;
          if (hr.action) emit({ type: "action", content: JSON.stringify(hr.action) });
          log("agent", `Step ${i + 1}: ${hr.logSuffix}`);
        }
      } catch (toolErr) {
        result = `Tool error ${toolUse.name}: ${(toolErr as Error).message}`;
        log("agent", `Step ${i + 1}: tool error → ${result}`);
      }

      emit({ type: "tool_result", content: result });
      // Truncate long results before adding to Claude's context
      const contextResult = truncateToolResult(result);
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: contextResult });
    }

    messages.push({ role: "user", content: toolResults as any });
  }

  const latencyMs = Date.now() - startTime;
  log(
    "agent",
    `Done (max steps): ${totalInputTokens}→${totalOutputTokens} tok, ${toolCalls} tool call${toolCalls !== 1 ? "s" : ""}, ${latencyMs}ms`
  );
  recordMetric({
    sessionId: "",
    userId: "default",
    model: selectedModel,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheHitPct: 0,
    toolCalls,
    steps: steps.length,
    latencyMs,
    error: "max_steps_reached",
  });
  const lastThink = steps.filter((s) => s.type === "think").pop();
  return {
    answer: lastThink?.content || "J'ai atteint la limite de raisonnement.",
    steps,
    toolCalls,
    model: selectedModel,
    latencyMs,
  };
}

// ── Ollama agent (JSON parsing) ──

async function runOllamaAgent(
  userMessage: string,
  history: LLMMessage[] = [],
  onStep?: OnStepCallback
): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  let toolCalls = 0;
  const emit = (step: AgentStep) => {
    steps.push(step);
    onStep?.(step);
  };
  const messages: LLMMessage[] = [...history];
  messages.push({ role: "user", content: userMessage });

  const systemPrompt = getOllamaSystemPrompt();

  for (let i = 0; i < MAX_STEPS; i++) {
    const response = await ask(systemPrompt, "", messages);
    const rawText = response.text.trim();
    const action = parseAgentResponse(rawText);

    if (!action) {
      steps.push({ type: "answer", content: rawText });
      return { answer: rawText, steps, toolCalls };
    }

    if (action.action === "answer") {
      steps.push({ type: "answer", content: action.text || rawText });
      return { answer: action.text || rawText, steps, toolCalls };
    }

    if (action.action === "sql" && action.query) {
      steps.push({ type: "tool_call", content: `SQL: ${action.query}`, toolName: "execute_sql" });
      toolCalls++;
      const result = executeSafeSQL(action.query);
      steps.push({ type: "tool_result", content: result });

      messages.push({ role: "assistant", content: rawText });
      messages.push({
        role: "user",
        content: `Résultat de la requête :\n${result}\n\nAnalyse ces résultats et continue. Si tu as assez d'informations, donne ta réponse finale avec {"action": "answer", "text": "..."}.`,
      });

      log("agent", `Step ${i + 1}: SQL → ${result.split("\n").length} lines`);
      continue;
    }

    steps.push({ type: "answer", content: rawText });
    return { answer: rawText, steps, toolCalls };
  }

  const lastStep = steps[steps.length - 1];
  return {
    answer: lastStep?.content || "J'ai atteint la limite de raisonnement.",
    steps,
    toolCalls,
  };
}

// ── JSON parser for Ollama ──

interface AgentAction {
  action: string;
  query?: string;
  text?: string;
}

function parseAgentResponse(raw: string): AgentAction | null {
  try {
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");

    let depth = 0;
    let start = -1;
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (cleaned[i] === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          const candidate = cleaned.substring(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (typeof parsed.action === "string") return parsed as AgentAction;
          } catch {
            /* continue */
          }
          start = -1;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
