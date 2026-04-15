/**
 * Abstraction LLM — switchable Ollama (local) / Claude (cloud)
 *
 * Ollama  → mode JSON ({"action":"sql","query":"..."})
 * Claude  → mode tool_use natif (structured tool calls)
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
}

// ── Claude tool_use types ──

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

export type ContentBlock = ToolUseBlock | TextBlock | ThinkingBlock;

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[] | ToolResultBlock[];
}

export interface ClaudeResponse {
  content: ContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  model: string;
}

// ── Provider state ──

let provider = process.env.LLM_PROVIDER || "ollama";

export function setLLMProvider(p: "ollama" | "claude") {
  provider = p;
}
export function getLLMProvider() {
  return provider;
}

const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "qwen3:8b";
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";

// ── Model constants (single source of truth) ──

export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const CLAUDE_MODEL_DEEP = process.env.CLAUDE_MODEL_DEEP || "claude-opus-4-6";
export const getOllamaModelName = (): string => ollamaModel;

// ── Simple ask (Ollama + Claude text-only fallback) ──

export async function ask(systemPrompt: string, userMessage: string, history: LLMMessage[] = []): Promise<LLMResponse> {
  if (provider === "ollama") {
    return askOllama(systemPrompt, userMessage, history);
  } else if (provider === "claude") {
    return askClaudeSimple(systemPrompt, userMessage, history);
  }
  throw new Error(`Unknown LLM provider: ${provider}`);
}

// ── Claude tool_use API (for agent) ──

export async function askClaudeWithTools(
  systemPrompt: string,
  messages: ClaudeMessage[],
  tools: ToolDefinition[],
  thinkingBudget: number = 16000,
  modelOverride?: string
): Promise<ClaudeResponse> {
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set in .env");

  const model = modelOverride || CLAUDE_MODEL;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.max(64000, thinkingBudget + 16000),
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        tools:
          tools.length > 0
            ? [...tools.slice(0, -1), { ...tools[tools.length - 1], cache_control: { type: "ephemeral" } }]
            : [],
        messages,
        thinking: {
          type: "enabled",
          budget_tokens: thinkingBudget,
        },
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as ClaudeResponse;
      return data;
    }

    const errorText = await res.text();

    // Rate limit → retry with backoff
    if (res.status === 429 && attempt < maxRetries) {
      const wait = Math.pow(2, attempt) * 1000; // 2s, 4s
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    // Overloaded → retry
    if (res.status === 529 && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    // Non-retryable errors
    if (res.status === 401) throw new Error("Invalid Claude API key. Check ANTHROPIC_API_KEY in .env");
    if (res.status === 404) throw new Error(`Model ${model} not found. Check your access.`);
    throw new Error(`Claude API error (${res.status}): ${errorText}`);
  }

  throw new Error("Claude API: failed after 3 retries");
}

// ── Claude streaming API (for final answer) ──

export async function askClaudeWithToolsStreaming(
  systemPrompt: string,
  messages: ClaudeMessage[],
  tools: ToolDefinition[],
  onTextDelta: (text: string) => void,
  thinkingBudget: number = 16000,
  modelOverride?: string
): Promise<ClaudeResponse> {
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set in .env");

  const model = modelOverride || CLAUDE_MODEL;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.max(64000, thinkingBudget + 16000),
        stream: true,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        tools:
          tools.length > 0
            ? [...tools.slice(0, -1), { ...tools[tools.length - 1], cache_control: { type: "ephemeral" } }]
            : [],
        messages,
        thinking: {
          type: "enabled",
          budget_tokens: thinkingBudget,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 429 && attempt < maxRetries) {
        const wait = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (res.status === 529 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      if (res.status === 401) throw new Error("Invalid Claude API key. Check ANTHROPIC_API_KEY in .env");
      throw new Error(`Claude API error (${res.status}): ${errorText}`);
    }

    // Parse SSE stream from Anthropic
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Accumulate the full response
    const contentBlocks: ContentBlock[] = [];
    let stopReason: "end_turn" | "tool_use" | "max_tokens" = "end_turn";
    let currentBlockIdx = -1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          if (event.type === "content_block_start") {
            currentBlockIdx = event.index;
            if (event.content_block.type === "text") {
              contentBlocks[currentBlockIdx] = { type: "text", text: "" } as TextBlock;
            } else if (event.content_block.type === "thinking") {
              contentBlocks[currentBlockIdx] = { type: "thinking", thinking: "", signature: "" } as any;
            } else if (event.content_block.type === "tool_use") {
              contentBlocks[currentBlockIdx] = {
                type: "tool_use",
                id: event.content_block.id,
                name: event.content_block.name,
                input: {},
              } as ToolUseBlock;
            }
          } else if (event.type === "content_block_delta") {
            const block = contentBlocks[event.index];
            if (!block) continue;

            if (event.delta.type === "text_delta" && block.type === "text") {
              (block as any).text += event.delta.text;
              onTextDelta(event.delta.text);
            } else if (event.delta.type === "thinking_delta" && block.type === "thinking") {
              (block as any).thinking += event.delta.thinking;
            } else if (event.delta.type === "signature_delta" && block.type === "thinking") {
              (block as any).signature = ((block as any).signature || "") + event.delta.signature;
            } else if (event.delta.type === "input_json_delta" && block.type === "tool_use") {
              // Accumulate JSON string for tool input
              if (!(block as any)._inputJson) (block as any)._inputJson = "";
              (block as any)._inputJson += event.delta.partial_json;
            }
          } else if (event.type === "content_block_stop") {
            const block = contentBlocks[event.index];
            if (block?.type === "tool_use" && (block as any)._inputJson) {
              try {
                (block as any).input = JSON.parse((block as any)._inputJson);
              } catch {
                /* */
              }
              delete (block as any)._inputJson;
            }
          } else if (event.type === "message_delta") {
            if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
          }
        } catch {
          /* skip malformed events */
        }
      }
    }

    // Defensive cleanup: strip the temporary _inputJson scratch field from any
    // tool_use block before returning. The Anthropic API rejects unknown fields
    // when these blocks are echoed back in the next turn's assistant message.
    const cleanBlocks = contentBlocks.filter(Boolean).map((block) => {
      if (block?.type === "tool_use") {
        const b = block as any;
        if (b._inputJson !== undefined) {
          // Last-chance parse if content_block_stop never fired for this block.
          if (!b.input || Object.keys(b.input).length === 0) {
            try {
              b.input = JSON.parse(b._inputJson);
            } catch {
              b.input = {};
            }
          }
          delete b._inputJson;
        }
      }
      return block;
    });

    return {
      content: cleanBlocks,
      stop_reason: stopReason,
      model,
    };
  }

  throw new Error("Claude streaming API: failed after 3 retries");
}

// ── Health check ──

export async function checkHealth(): Promise<{ ok: boolean; provider: string; model: string; error?: string }> {
  if (provider === "ollama") {
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (!res.ok) return { ok: false, provider, model: ollamaModel, error: `Ollama HTTP ${res.status}` };
      const data = (await res.json()) as { models?: { name: string }[] };
      const models = data.models?.map((m) => m.name) || [];
      const hasModel = models.some((m) => m.startsWith(ollamaModel.split(":")[0]));
      return {
        ok: hasModel,
        provider,
        model: ollamaModel,
        error: hasModel ? undefined : `Model ${ollamaModel} not found. Available: ${models.join(", ")}`,
      };
    } catch {
      return {
        ok: false,
        provider,
        model: ollamaModel,
        error: `Ollama not reachable at ${ollamaUrl}. Run: ollama serve`,
      };
    }
  }
  return {
    ok: !!anthropicKey,
    provider,
    model: CLAUDE_MODEL,
    error: anthropicKey ? undefined : "ANTHROPIC_API_KEY not set in .env",
  };
}

// ── Ollama (local) ──

async function askOllama(systemPrompt: string, userMessage: string, history: LLMMessage[]): Promise<LLMResponse> {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  if (userMessage) messages.push({ role: "user", content: userMessage });

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: ollamaModel, stream: false, messages }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ollama error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as { message: { content: string } };
  return { text: data.message.content, model: ollamaModel, provider: "ollama" };
}

// ── Claude simple text (for /summarize) ──

async function askClaudeSimple(systemPrompt: string, userMessage: string, history: LLMMessage[]): Promise<LLMResponse> {
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set in .env");

  const model = CLAUDE_MODEL;
  const messages = [
    ...history.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
    ...(userMessage ? [{ role: "user" as const, content: userMessage }] : []),
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 32000, system: systemPrompt, messages }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as { content: { type: string; text: string }[] };
  const text = data.content.find((c) => c.type === "text")?.text || "";
  return { text, model, provider: "claude" };
}
