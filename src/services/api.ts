/**
 * Service API — Communication frontend → backend
 *
 * Toutes les fonctions fetch vers le backend Express.
 * En dev, les requêtes /api/* sont proxiées par Vite vers localhost:3001.
 */

export const API_BASE = "/api";

// ── Download progress tracker (used by hydration loading bar) ──

type ProgressListener = (received: number, total: number) => void;
let _progressListener: ProgressListener | null = null;
let _totalReceived = 0;
// Estimated total bytes (decompressed) for all hydration endpoints combined.
// Based on measured sizes: CRM ~21Mo + SAP ~17Mo + Staffing ~1Mo + rest ~2Mo ≈ 41Mo
const ESTIMATED_TOTAL_BYTES = 41_000_000;

export function setHydrationProgressListener(listener: ProgressListener | null): void {
  _progressListener = listener;
  _totalReceived = 0;
}

/**
 * Fetch JSON with real-time download progress tracking via ReadableStream.
 * Counts decompressed bytes received (browser transparently decompresses gzip).
 * Falls back to regular res.json() if body streaming is unavailable.
 */
async function fetchJsonWithProgress(res: Response): Promise<any> {
  if (!_progressListener || !res.body) return res.json();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    _totalReceived += value.length;
    _progressListener(_totalReceived, ESTIMATED_TOTAL_BYTES);
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(combined));
}

/**
 * Fetch wrapper that injects the JWT Authorization header
 * and handles 401 responses by redirecting to login.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("jwt");
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem("jwt");
    window.location.reload();
  }
  return res;
}

// ── Chat IA ──

interface ChatResponse {
  reply: string;
  sessionId: string;
  model: string;
  provider: string;
  thinking?: string[];
  toolsUsed?: string[];
}

export async function chatWithAI(
  message: string,
  sessionId?: string,
  context?: Record<string, unknown>
): Promise<ChatResponse> {
  const res = await apiFetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, context }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}

export interface StreamStep {
  type: "think" | "tool_call" | "tool_result" | "answer" | "action";
  content: string;
}

export interface StreamCallbacks {
  onStep: (step: StreamStep) => void;
  onDone: (data: { reply: string; sessionId: string; provider: string }) => void;
  onError: (error: string) => void;
  onTextDelta?: (text: string) => void;
  onSession?: (sessionId: string) => void;
}

export interface ScoringConfig {
  minAvailPct: number;
  minSkillsPct: number;
  maxGradeDist: number;
  periodTolerance: number;
}

export interface DashboardContext {
  activeTab: string;
  filters?: Record<string, unknown>;
  kpis?: Record<string, unknown>;
  activeScenario?: { name: string; overrideCount: number };
  selectedOpportunities?: { name: string; account: string; status: number }[];
  focusedEmployee?: { empId: string; jobName?: string };
}

export async function chatWithAIStream(
  message: string,
  sessionId: string | undefined,
  callbacks: StreamCallbacks,
  scoringConfig?: ScoringConfig,
  dashboardContext?: DashboardContext,
  signal?: AbortSignal
) {
  // Try streaming first; if the proxy buffers the response (done=true after first chunk
  // without a "done" event), fall back to collected data or the non-streaming endpoint.
  let gotDoneEvent = false;
  let collectedText = "";
  let collectedSessionId = sessionId || "";
  let gotAnyData = false;

  try {
    const res = await apiFetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId, scoringConfig, dashboardContext }),
      signal,
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                gotAnyData = true;
                if (eventType === "step") callbacks.onStep(data);
                else if (eventType === "text_delta" && callbacks.onTextDelta) {
                  callbacks.onTextDelta(data.text);
                  collectedText += data.text;
                } else if (eventType === "done") {
                  gotDoneEvent = true;
                  callbacks.onDone({
                    reply: data.reply,
                    sessionId: data.sessionId || sessionId || "",
                    provider: data.provider,
                  });
                } else if (eventType === "session") {
                  if (data.sessionId && callbacks.onSession) callbacks.onSession(data.sessionId);
                  collectedSessionId = data.sessionId || collectedSessionId;
                } else if (eventType === "error") {
                  gotDoneEvent = true;
                  callbacks.onError(data.error);
                }
              } catch {
                /* malformed JSON */
              }
              eventType = "";
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    // Stream failed — fall through to fallback
  }

  // Fallback: if stream closed without a "done" event
  if (!gotDoneEvent) {
    // If we collected text from the partial stream, use it instead of making a 2nd request
    if (collectedText.trim()) {
      callbacks.onDone({ reply: collectedText, sessionId: collectedSessionId, provider: "" });
    } else if (!gotAnyData) {
      // Nothing came through — try the non-streaming endpoint as last resort
      try {
        const res = await apiFetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, sessionId, scoringConfig, dashboardContext }),
          signal,
        });
        if (!res.ok) {
          callbacks.onError("Network error");
          return;
        }
        const data = await res.json();
        callbacks.onDone({
          reply: data.reply,
          sessionId: data.sessionId || sessionId || "",
          provider: data.provider || "",
        });
      } catch (err: any) {
        if (err?.name === "AbortError") throw err;
        callbacks.onError("Network error");
      }
    } else {
      // Got some data (steps) but no text and no done — report partial failure
      callbacks.onError("The response was interrupted. Please try again.");
    }
  }
}

export async function sendChatFeedback(sessionId: string, messageId: string, rating: number): Promise<void> {
  await apiFetch(`${API_BASE}/chat/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, messageId, rating }),
  });
}

export async function getChatHistory(sessionId: string) {
  const res = await apiFetch(`${API_BASE}/chat/history?sessionId=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getChatSessions() {
  const res = await apiFetch(`${API_BASE}/chat/sessions`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function checkAIHealth() {
  const res = await apiFetch(`${API_BASE}/chat/health`);
  if (!res.ok) return { status: "error" };
  return res.json();
}

// ── Summarize ──

interface SummaryResponse {
  type: string;
  summary: string;
  model: string;
  generatedAt: string;
}

export async function generateSummary(
  type: "executive" | "pipeline" | "staffing" | "alerts"
): Promise<SummaryResponse> {
  const res = await apiFetch(`${API_BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Data ──

export async function getEmployees(params?: { grade?: string; team?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.grade) query.set("grade", params.grade);
  if (params?.team) query.set("team", params.team);
  if (params?.search) query.set("search", params.search);

  const res = await apiFetch(`${API_BASE}/data/employees?${query}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getEmployee(empId: string) {
  const res = await apiFetch(`${API_BASE}/data/employees/${encodeURIComponent(empId)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getOpportunities(params?: { status?: string; search?: string; segment?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.segment) query.set("segment", params.segment);

  const res = await apiFetch(`${API_BASE}/data/opportunities?${query}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getStats() {
  const res = await apiFetch(`${API_BASE}/data/stats`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getAlerts() {
  const res = await apiFetch(`${API_BASE}/data/alerts`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Hydration ──

export async function hydrateRegions() {
  const res = await apiFetch(`${API_BASE}/hydrate/regions`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function hydrateCrm(opts?: {
  region?: string;
  country?: string;
  since?: string;
  page?: string;
  pageSize?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.country) params.set("country", opts.country);
  else if (opts?.region) params.set("region", opts.region);
  if (opts?.since) params.set("since", opts.since);
  if (opts?.page) params.set("page", opts.page);
  if (opts?.pageSize) params.set("pageSize", opts.pageSize);
  const query = params.toString() ? `?${params}` : "";
  const res = await apiFetch(`${API_BASE}/hydrate/crm${query}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return fetchJsonWithProgress(res);
}

export async function hydrateStaffing() {
  const res = await apiFetch(`${API_BASE}/hydrate/staffing`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return fetchJsonWithProgress(res);
}

export async function hydrateMetadata() {
  const res = await apiFetch(`${API_BASE}/hydrate/metadata`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return fetchJsonWithProgress(res);
}

export async function hydrateSkills() {
  const res = await apiFetch(`${API_BASE}/hydrate/skills`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return fetchJsonWithProgress(res);
}

export async function hydrateSap() {
  const res = await apiFetch(`${API_BASE}/hydrate/sap`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return fetchJsonWithProgress(res);
}

export async function hydrateChanges() {
  const res = await apiFetch(`${API_BASE}/hydrate/changes`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return fetchJsonWithProgress(res);
}

export async function hydrateRecruitment() {
  const res = await apiFetch(`${API_BASE}/hydrate/recruitment`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function hydrateEmployees() {
  const res = await apiFetch(`${API_BASE}/hydrate/employees`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function hydrateGrid() {
  const res = await apiFetch(`${API_BASE}/hydrate/grid`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function saveChanges(data: Record<string, unknown>) {
  const { TAB_ID } = await import("../utils/tabId");
  const res = await apiFetch(`${API_BASE}/hydrate/changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, _tabId: TAB_ID }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── CRM Refresh ──

export interface RefreshStatus {
  running: boolean;
  lastRun: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

export async function triggerCrmRefresh(): Promise<{ status: string; message: string }> {
  const res = await apiFetch(`${API_BASE}/refresh/crm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `API error: ${res.status}`);
  }

  return res.json();
}

export async function getRefreshStatus(): Promise<RefreshStatus> {
  const res = await apiFetch(`${API_BASE}/refresh/status`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Demo ──

export async function getDemoStatus(): Promise<{ demo: boolean; hasData: boolean; provider: string }> {
  const res = await apiFetch(`${API_BASE}/demo/status`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function activateDemo(): Promise<{ demo: boolean; hasData: boolean }> {
  const res = await apiFetch(`${API_BASE}/demo/activate`, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function deactivateDemo(): Promise<{ demo: boolean }> {
  const res = await apiFetch(`${API_BASE}/demo/deactivate`, { method: "POST" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Health ──

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Staffing API ──

export async function fetchStaffingCandidates(params: {
  needId?: string;
  grade?: string;
  skills?: string[];
  periodStart?: string;
  periodEnd?: string;
  maxGradeDistance?: number;
  periodTolerance?: number;
}) {
  const query = new URLSearchParams();
  if (params.needId) query.set("needId", params.needId);
  if (params.grade) query.set("grade", params.grade);
  if (params.skills?.length) query.set("skills", params.skills.join(","));
  if (params.periodStart) query.set("periodStart", params.periodStart);
  if (params.periodEnd) query.set("periodEnd", params.periodEnd);
  if (params.maxGradeDistance !== undefined) query.set("maxGradeDistance", String(params.maxGradeDistance));
  if (params.periodTolerance !== undefined) query.set("periodTolerance", String(params.periodTolerance));
  const res = await apiFetch(`${API_BASE}/staffing/candidates?${query}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchSkillsCatalog() {
  const res = await apiFetch(`${API_BASE}/staffing/skills/catalog`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── BCS CM1 Simulator ──

export interface BcsGradeRow {
  grade: string;
  scrPerDay: number;
  actualDays: number;
  forecastDays: number;
  projectedDays: number;
  projectedCost: number;
  actualByYear: Record<number, number>;
  forecastByYear: Record<number, number>;
}

export interface BcsOpportunity {
  id: string;
  name: string;
  account: string;
  grossRevenue: number;
  netRevenue: number;
  cm1Pct: number;
  status: number;
  creationDate: string | null;
  bookingDate: string | null;
  serviceLine: string | null;
}

export interface BcsEmployee {
  empId: string;
  name: string;
  grade: string;
  actualDays: number;
  forecastDays: number;
  cosYear: number;
}

export interface BcsMagrProfile {
  grade: string;
  scr: number;
  rcAdvisory: number;
  rcImplementation: number;
  rcStrategy: number;
  advanced: boolean;
}

export interface BcsResponse {
  available: boolean;
  opportunities: BcsOpportunity[];
  byGrade: BcsGradeRow[];
  employees: BcsEmployee[];
  scrRates: Record<string, number>;
  rateCards: Record<string, Record<string, number>>;
  magrProfiles: Record<string, BcsMagrProfile>;
  baseYear: number;
  asOf: string;
}

export interface BcsRatesResponse {
  scrRates: Record<string, number>;
  rateCards: Record<string, Record<string, number>>;
  magrProfiles: Record<string, BcsMagrProfile>;
}

export async function fetchBcsRates(): Promise<BcsRatesResponse> {
  const res = await apiFetch(`${API_BASE}/bcs/rates/all`);
  if (!res.ok) throw new Error(`BCS rates API error: ${res.status}`);
  return res.json();
}

export async function fetchBcsData(jobcode: string): Promise<BcsResponse> {
  const res = await apiFetch(`${API_BASE}/bcs/${encodeURIComponent(jobcode)}`);
  if (!res.ok) throw new Error(`BCS API error: ${res.status}`);
  return res.json();
}
