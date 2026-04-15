/**
 * ChatPanel — Panneau flottant de chat IA
 *
 * FAB en bas à gauche → ouvre un panneau de conversation avec l'IA.
 * S'adapte au provider : Be.on° (Ollama local) ou Claude (Anthropic).
 */

import { memo, useState, useRef, useEffect, useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Fade from "@mui/material/Fade";
import CloseIcon from "@mui/icons-material/Close";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import {
  chatWithAIStream,
  checkAIHealth,
  generateSummary,
  getDemoStatus,
  getChatHistory,
  hydrateChanges,
  sendChatFeedback,
  type StreamStep,
  type ScoringConfig,
  type DashboardContext,
} from "../../services/api";
import { easing, timing, keyframes } from "../../styles/animations";
import { chatBranding } from "../../config/brandConfig";
import { useThemeStore } from "../../stores/useThemeStore";
import { useUserDataStore } from "../../stores/useUserDataStore";
import { useUIStore } from "../../stores/useUIStore";
import useScenarioStore from "../../stores/useScenarioStore";
import { restoreUserChanges } from "../../utils/restoreUserChanges";
import { InlineChart } from "./components/InlineChart";
import { ActionChecklist } from "./components/ActionChecklist";
import { ChatInput } from "./components/ChatInput";
import { MessageBubble, type Message } from "./components/ChatMessageBubble";

import { ChatMarkdown, parseStructuredBlocks, type ChatAction, type ChatChart } from "./components/ChatMarkdown";

// ── Suggestions rapides ──

const QUICK_PROMPTS = [
  "Who is available this month?",
  "Summarize the pipeline",
  "Top 5 opportunities by revenue",
  "Current alerts",
];

// Detect if a message should use the /summarize endpoint instead of /chat
const SUMMARY_PATTERNS: [RegExp, "executive" | "pipeline" | "staffing" | "alerts"][] = [
  [/^résumé?\s+exécutif|^brief\s+comité|^synthèse\s+globale|^executive\s+summary|^committee\s+brief/i, "executive"],
  [/^résumé?\s+(du\s+)?pipeline|^analyse\s+pipeline|^summarize.*pipeline|^pipeline\s+summary/i, "pipeline"],
  [/^résumé?\s+(du\s+)?staffing|^analyse\s+staffing|^situation\s+staffing|^staffing\s+summary/i, "staffing"],
  [/^résumé?\s+(des\s+)?alertes|^analyse\s+alertes|^current\s+alerts|^alerts\s+summary/i, "alerts"],
];

// ── Branding par provider (from brandConfig) ──
const castBrand = (b: typeof chatBranding.ollama) => ({
  ...b,
  headerIconFilter: b.headerIconFilter as string | undefined,
});
const BRANDING = { ollama: castBrand(chatBranding.ollama), claude: castBrand(chatBranding.claude) };

// ── Composant ──

const ChatPanel = memo(() => {
  const theme = useTheme();
  const darkMode = useThemeStore((s) => s.darkMode);
  const isDark = darkMode || theme.palette.mode === "dark";

  // Position after Create FAB (48px) + gap (12px) + optional Staffing FAB (48px + 12px)
  const hasStaffingNeeds = useUserDataStore((s) => {
    for (const items of Object.values(s.staffingNeeds)) {
      if (items.length > 0) return true;
    }
    return false;
  });
  const fabLeftPos = 32 + 48 + 12 + (hasStaffingNeeds ? 48 + 12 : 0);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveSteps, setLiveSteps] = useState<StreamStep[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [aiStatus, setAiStatus] = useState<"unknown" | "ok" | "error">("unknown");
  const [sessionId, setSessionId] = useState<string>(`session_${crypto.randomUUID()}`);
  const [provider, setProvider] = useState<"ollama" | "claude">("ollama");
  // panelSize removed — overlay has fixed layout
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>({
    minAvailPct: 1,
    minSkillsPct: 1,
    maxGradeDist: 1,
    periodTolerance: 1,
  });

  const abortRef = useRef<AbortController | null>(null);

  const navigate = useNavigate();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pb = BRANDING[provider];

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveSteps, streamingText]);

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Escape to close overlay
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  // Restore chat history when opening with existing session
  useEffect(() => {
    if (open && messages.length === 0 && sessionId) {
      getChatHistory(sessionId)
        .then((data) => {
          if (data?.messages?.length > 0) {
            setMessages(
              data.messages.map((m: any, i: number) => ({
                id: `restored_${i}`,
                role: m.role,
                content: m.message,
                timestamp: new Date(m.createdAt),
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [open, sessionId]); // intentionally omit messages to only run on first open

  // Check AI health + detect provider
  useEffect(() => {
    if (aiStatus === "unknown") {
      Promise.all([
        checkAIHealth().catch(() => ({ ok: false })),
        getDemoStatus().catch(() => ({ provider: "ollama" })),
      ]).then(([health, demo]) => {
        setAiStatus((health as any).ok ? "ok" : "error");
        setProvider((demo as any).provider === "claude" ? "claude" : "ollama");
      });
    }
  }, [aiStatus]);

  // Re-check provider when panel opens
  useEffect(() => {
    if (open) {
      getDemoStatus()
        .then((s) => setProvider(s.provider === "claude" ? "claude" : "ollama"))
        .catch(() => {});
      checkAIHealth()
        .then((h) => setAiStatus(h.ok ? "ok" : "error"))
        .catch(() => setAiStatus("error"));
    }
  }, [open]);

  // ── Handle AI action steps (write tools & navigation) ──
  const handleActionStep = useCallback(
    (content: string) => {
      try {
        const action = JSON.parse(content);
        const tabMap: Record<string, string> = { pipeline: "/pipeline", bookings: "/bookings", staffing: "/staffing" };

        switch (action.action) {
          // Navigation, filters, view changes, export — ignored unless user explicitly asked
          // These are only proposed via propose_actions buttons, never auto-executed
          case "navigate":
          case "apply_filters":
          case "change_staffing_view":
          case "export":
            break;

          // DB write actions — re-hydrate stores
          case "staffing_need_created":
          case "action_created":
          case "status_updated":
          case "opportunity_created":
          case "opportunity_deleted":
          case "revenue_team_updated":
          case "scenario_created":
          case "employee_updated": {
            hydrateChanges()
              .then((changes) => {
                if (changes && Object.keys(changes).length > 0) restoreUserChanges(changes);
              })
              .catch(() => {});
            break;
          }
          // Download file
          case "download": {
            if (action.url) {
              const a = document.createElement("a");
              a.href = action.url;
              a.download = action.fileName || "download";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
            break;
          }
        }
      } catch {
        /* ignore non-JSON action content */
      }
    },
    [navigate]
  );

  // ── Stop generation ──
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // Append whatever streamed text was collected so far as a partial message
    if (streamingText) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_partial`,
          role: "assistant" as const,
          content: streamingText + "\n\n*(generation interrupted)*",
          timestamp: new Date(),
        },
      ]);
    }
    setLoading(false);
    setLiveSteps([]);
    setStreamingText("");
  }, [streamingText]);

  const hasSpeechAPI = useMemo(
    () => !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition,
    []
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || loading) return;

      // Abort any previous SSE stream
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: Message = {
        id: `msg_${Date.now()}_u`,
        role: "user",
        content: msg,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const next = [...prev, userMessage];
        return next.length > 200 ? next.slice(-200) : next; // Cap at 200 messages to prevent memory bloat
      });
      setInput("");
      setLoading(true);
      setLiveSteps([]);
      setStreamingText("");

      try {
        const summaryMatch = SUMMARY_PATTERNS.find(([pattern]) => pattern.test(msg));

        if (summaryMatch) {
          const result = await generateSummary(summaryMatch[1]);
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now()}_a`,
              role: "assistant" as const,
              content: result.summary,
              timestamp: new Date(),
            },
          ]);
        } else {
          const collectedSteps: StreamStep[] = [];
          let rafPending = false;
          let streamBuf = "";
          let streamSessionId = sessionId;

          await chatWithAIStream(
            msg,
            sessionId,
            {
              onSession: (newSessionId) => {
                streamSessionId = newSessionId;
              },
              onStep: (step) => {
                collectedSteps.push(step);
                if (step.type === "action") handleActionStep(step.content);
                if (!rafPending) {
                  rafPending = true;
                  requestAnimationFrame(() => {
                    setLiveSteps([...collectedSteps]);
                    rafPending = false;
                  });
                }
              },
              onTextDelta: (text) => {
                streamBuf += text;
                if (!rafPending) {
                  rafPending = true;
                  requestAnimationFrame(() => {
                    setStreamingText(streamBuf);
                    rafPending = false;
                  });
                }
              },
              onDone: (data) => {
                setSessionId(data.sessionId || streamSessionId);
                setLiveSteps([]);
                const thinking = collectedSteps.filter((s) => s.type === "think").map((s) => s.content);
                const toolsUsed = collectedSteps.filter((s) => s.type === "tool_call").map((s) => s.content);
                const actionSteps = collectedSteps.filter((s) => s.type === "action");
                let suggestions: string[] | undefined;
                let actions: ChatAction[] | undefined;
                const charts: ChatChart[] = [];
                for (const a of actionSteps) {
                  try {
                    const parsed = JSON.parse(a.content);
                    if (parsed.action === "followups" && parsed.suggestions) suggestions = parsed.suggestions;
                    if (parsed.action === "propose_actions" && parsed.actions) actions = parsed.actions;
                    if (parsed.action === "render_chart") charts.push(parsed as ChatChart);
                  } catch {
                    /* */
                  }
                }
                const rawText = data.reply || streamBuf || "";
                const parsed = parseStructuredBlocks(rawText);
                const finalText = parsed.cleanText;
                if (!suggestions && parsed.suggestions) suggestions = parsed.suggestions;
                if ((!actions || actions.length === 0) && parsed.actions) actions = parsed.actions;
                if (parsed.charts) charts.push(...parsed.charts);

                setStreamingText("");
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `msg_${Date.now()}_a`,
                    role: "assistant" as const,
                    content: finalText,
                    timestamp: new Date(),
                    thinking: thinking.length > 0 ? thinking : undefined,
                    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
                    suggestions,
                    actions: actions && actions.length > 0 ? actions : undefined,
                    charts: charts.length > 0 ? charts : undefined,
                  },
                ]);
              },
              onError: (err) => {
                setLiveSteps([]);
                setStreamingText("");
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `msg_${Date.now()}_e`,
                    role: "assistant" as const,
                    content: `Error: ${err}`,
                    timestamp: new Date(),
                  },
                ]);
              },
            },
            scoringConfig,
            (() => {
              // Build enriched dashboard context
              const ctx: DashboardContext = { activeTab: window.location.pathname };
              // Active scenario
              const scenario = useScenarioStore.getState().getActiveScenario();
              if (scenario) {
                const overrides = scenario.assignmentOverrides ? Object.keys(scenario.assignmentOverrides).length : 0;
                ctx.activeScenario = { name: scenario.name, overrideCount: overrides };
              }
              // Selected opportunities (pipeline/bookings tabs)
              const selOpps = useUIStore.getState().selectedOpportunities;
              if (selOpps.length > 0) {
                ctx.selectedOpportunities = selOpps
                  .slice(0, 3)
                  .map((o: any) => ({ name: o.opportunity || o.name, account: o.account, status: o.status }));
              }
              // Staffing focus (employee being edited)
              const prefill = useUIStore.getState().bulkEditPrefill;
              if (prefill?.empId) ctx.focusedEmployee = { empId: prefill.empId, jobName: prefill.jobName };
              return ctx;
            })(),
            controller.signal
          );
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setLiveSteps([]);
        setStreamingText("");
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_e`,
            role: "assistant" as const,
            content:
              provider === "claude"
                ? "Sorry, an error occurred. Make sure the backend is running and the Claude API key is configured."
                : "Sorry, an error occurred. Make sure the backend and Ollama are running.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, sessionId, provider, scoringConfig, handleActionStep]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleNewSession = useCallback(() => {
    setMessages([]);
    setSessionId(`session_${crypto.randomUUID()}`);
  }, []);

  // ── Direct action execution ──
  const handleActionClick = useCallback(
    (action: ChatAction) => {
      const tabMap: Record<string, string> = { pipeline: "/pipeline", bookings: "/bookings", staffing: "/staffing" };

      switch (action.action) {
        case "navigate":
          if (action.data.tab && tabMap[action.data.tab as string]) {
            navigate(tabMap[action.data.tab as string]);
            setOpen(false);
          }
          break;
        case "apply_filters":
        case "change_staffing_view":
          useUIStore.getState().setLastAiAction({ action: action.action, data: action.data });
          if (action.data.tab && tabMap[action.data.tab as string]) {
            navigate(tabMap[action.data.tab as string]);
          }
          break;
        default:
          // For write actions (create_staffing_need, etc.), still use LLM
          handleSend(`Execute l'action : ${action.label} (${action.action} avec ${JSON.stringify(action.data)})`);
      }
    },
    [navigate, handleSend]
  );

  // ── Batch-validate checked actions from checklist ──
  const handleValidateActions = useCallback(
    (actions: ChatAction[]) => {
      const immediate: ChatAction[] = [];
      const writes: ChatAction[] = [];
      for (const a of actions) {
        if (["navigate", "apply_filters", "change_staffing_view"].includes(a.action)) {
          immediate.push(a);
        } else {
          writes.push(a);
        }
      }
      for (const a of immediate) handleActionClick(a);
      if (writes.length > 0) {
        const summary = writes.map((a) => `${a.label} (${a.action} with ${JSON.stringify(a.data)})`).join("\n- ");
        handleSend(`Execute the following actions:\n- ${summary}`);
      }
    },
    [handleActionClick, handleSend]
  );

  // ── Overlay is always dark — force white-on-dark palette ──
  const warm = useMemo(
    () => ({
      bg: "#1A1210",
      surface: "#241E1B",
      surfaceHover: "#2E2622",
      muted: "rgba(255,255,255,0.6)",
      text: "#FFFFFF",
      subtle: "rgba(255,255,255,0.06)",
      border: "rgba(255,255,255,0.1)",
      accent: "rgba(255,255,255,0.8)",
    }),
    []
  );

  return (
    <>
      {/* ── FAB Button ── */}
      <Fade in={!open && aiStatus !== "error"}>
        <Box sx={{ position: "fixed", bottom: 32, left: fabLeftPos, zIndex: 10001 }}>
          <Fab
            color="primary"
            size="medium"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir l'assistant IA"
            data-onboarding="chat"
            sx={{
              transition: "transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease",
              boxShadow: "0 6px 12px rgba(255, 61, 71, 0.3)",
              "&:hover": {
                transform: "scale(1.08)",
                boxShadow: "0 8px 16px rgba(255, 61, 71, 0.4)",
              },
            }}
          >
            <Box
              component="img"
              src={pb.fabIcon}
              sx={{ width: 24, height: 24, filter: pb.fabIconFilter }}
              alt={pb.name}
            />
          </Fab>
        </Box>
      </Fade>

      {/* ── Full-screen frosted chat overlay ── */}
      <Fade in={open} timeout={400} unmountOnExit>
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            pointerEvents: "auto",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            background: "rgba(0,0,0,0.6)",
          }}
        >
          {/* Full-screen split layout */}
          <Box
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{
              display: "flex",
              flexDirection: { xs: "column", lg: "row" },
              height: "100%",
              overflow: "hidden",
            }}
          >
            {/* ══ LEFT PANEL: Conversation ══ */}
            <Box
              sx={{
                flex: { xs: "1 1 auto", lg: "0 0 55%" },
                display: "flex",
                flexDirection: "column",
                height: "100%",
                minWidth: 0,
                borderRight: { xs: "none", lg: "1px solid rgba(255,255,255,0.06)" },
              }}
            >
              {/* ── Messages (bottom-aligned) ── */}
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2.5,
                  px: 2.5,
                  pt: 6,
                  pb: 2,
                  "&::-webkit-scrollbar": { display: "none" },
                  scrollbarWidth: "none",
                }}
              >
                {/* Spacer — pushes messages to the bottom, shrinks when content overflows */}
                <Box sx={{ flexGrow: 1, flexShrink: 0, minHeight: 0 }} />

                {/* Message de bienvenue */}
                {messages.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 8, mt: "auto", mb: "auto" }}>
                    <Box
                      component="img"
                      src={pb.headerIcon}
                      sx={{
                        width: pb.headerIconSize,
                        height: pb.headerIconSize,
                        mb: 2,
                        opacity: 0.5,
                        filter: pb.headerIconFilter || "brightness(2)",
                      }}
                      alt={pb.name}
                    />
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)", mb: 3, fontSize: 14 }}>
                      {provider === "claude"
                        ? "Ask Claude a question about the demo data."
                        : "Ask a question about your staffing, pipeline or bookings data."}
                    </Typography>

                    {/* Suggestions rapides */}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, justifyContent: "center" }}>
                      {QUICK_PROMPTS.map((prompt) => (
                        <Chip
                          key={prompt}
                          label={prompt}
                          size="small"
                          onClick={() => handleSend(prompt)}
                          sx={{
                            fontSize: 12,
                            bgcolor: "rgba(255,255,255,0.08)",
                            color: "rgba(255,255,255,0.6)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            cursor: "pointer",
                            fontWeight: 500,
                            "&:hover": {
                              bgcolor: "rgba(255,255,255,0.15)",
                              color: "rgba(255,255,255,0.9)",
                            },
                            transition: `background-color ${timing.fast} ${easing.standard}, color ${timing.fast} ${easing.standard}`,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Messages */}
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isDark={true}
                    warm={warm}
                    provider={provider}
                    onSuggestionClick={(text) => handleSend(text)}
                    onFeedback={(messageId, rating) => {
                      sendChatFeedback(sessionId, messageId, rating).catch(() => {});
                    }}
                  />
                ))}

                {/* Live steps + loading — wrapped in assistant bubble */}
                {loading && (
                  <Box sx={{ display: "flex", flexDirection: "row", gap: 1.5, alignItems: "flex-start" }}>
                    <Box
                      sx={{
                        maxWidth: "85%",
                        px: 2,
                        py: 1.25,
                        borderRadius: "16px 16px 16px 4px",
                        bgcolor: "rgba(255,255,255,0.06)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.75,
                      }}
                    >
                      {/* Live thinking — show reasoning in real-time */}
                      {!streamingText && liveSteps.filter((s) => s.type === "think").length > 0 && (
                        <Box
                          sx={{
                            px: 1.5,
                            py: 1,
                            mb: 0.5,
                            borderRadius: 1,
                            bgcolor: "rgba(255,255,255,0.02)",
                            borderLeft: "2px solid rgba(255,255,255,0.06)",
                            maxHeight: 120,
                            overflowY: "auto",
                            "&::-webkit-scrollbar": { width: 3 },
                            "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.08)", borderRadius: 2 },
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "rgba(255,255,255,0.25)",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                              mb: 0.5,
                            }}
                          >
                            Raisonnement
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: 11,
                              lineHeight: 1.4,
                              color: "rgba(255,255,255,0.35)",
                              fontFamily: "monospace",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {(() => {
                              const lastThink = liveSteps.filter((s) => s.type === "think").pop();
                              const text = lastThink?.content || "";
                              return text.length > 500 ? "..." + text.slice(-500) : text;
                            })()}
                          </Typography>
                        </Box>
                      )}
                      {/* Live steps — show current activity with detail */}
                      {!streamingText && liveSteps.length > 0 && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, mb: 0.5 }}>
                          {liveSteps
                            .filter((s) => s.type === "tool_call")
                            .slice(-3)
                            .map((step, i) => (
                              <Typography
                                key={i}
                                sx={{
                                  fontSize: 10,
                                  color: "rgba(255,255,255,0.3)",
                                  bgcolor: "rgba(255,255,255,0.03)",
                                  px: 0.75,
                                  py: 0.15,
                                  borderRadius: 0.5,
                                  fontFamily: "monospace",
                                }}
                              >
                                {step.content.length > 70 ? step.content.slice(0, 70) + "..." : step.content}
                              </Typography>
                            ))}
                        </Box>
                      )}
                      {/* Streaming text (real-time tokens) */}
                      {streamingText && (
                        <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)" }}>
                          <ChatMarkdown
                            content={streamingText}
                            isDark={true}
                            warm={warm}
                            accent={provider === "claude" ? "#D97757" : warm.accent}
                          />
                        </Box>
                      )}
                      {/* Loading dots + stop button */}
                      {!streamingText && (
                        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            {[0, 1, 2].map((i) => (
                              <Box
                                key={i}
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  bgcolor: "rgba(255,255,255,0.5)",
                                  opacity: 0.4,
                                  animation: `pulse 1.2s ${easing.standard} ${i * 0.2}s infinite`,
                                  ...keyframes.pulse,
                                }}
                              />
                            ))}
                          </Box>
                          <Typography variant="body2" sx={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                            {liveSteps.length === 0
                              ? pb.thinking
                              : liveSteps[liveSteps.length - 1]?.type === "tool_result"
                                ? "Analyzing results..."
                                : liveSteps[liveSteps.length - 1]?.type === "tool_call"
                                  ? `${liveSteps.filter((s) => s.type === "tool_call").length > 1 ? `Step ${liveSteps.filter((s) => s.type === "tool_call").length} — ` : ""}Executing...`
                                  : liveSteps[liveSteps.length - 1]?.type === "think"
                                    ? "Reasoning..."
                                    : pb.thinking}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={handleStop}
                            aria-label="Stop generation"
                            sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#FF3D47" } }}
                          >
                            <StopCircleOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      )}
                      {/* Stop button when streaming text */}
                      {streamingText && (
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={handleStop}
                            aria-label="Stop generation"
                            sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#FF3D47" } }}
                          >
                            <StopCircleOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}

                <div ref={messagesEndRef} />
              </Box>

              <ChatInput
                provider={provider}
                pb={pb}
                input={input}
                setInput={setInput}
                loading={loading}
                inputRef={inputRef}
                onSend={handleSend}
                onKeyDown={handleKeyDown}
                onNewSession={handleNewSession}
                onClose={() => setOpen(false)}
                scoringConfig={scoringConfig}
                onScoringConfigChange={setScoringConfig}
                hasSpeechAPI={hasSpeechAPI}
              />
            </Box>
            {/* end LEFT PANEL */}

            {/* ══ RIGHT PANEL: Artifacts — hidden below 1200px (lg breakpoint) ══ */}
            <Box
              sx={{
                flex: "0 0 45%",
                display: { xs: "none", lg: "flex" },
                flexDirection: "column",
                height: "100%",
                minWidth: 0,
                overflowY: "auto",
                "&::-webkit-scrollbar": { display: "none" },
                scrollbarWidth: "none",
              }}
            >
              <Box sx={{ p: 3, pt: 5, display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Header */}
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.35)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Artefacts
                </Typography>

                {/* Charts from all messages (persistent) */}
                {messages
                  .filter((m) => m.charts && m.charts.length > 0)
                  .flatMap((m, mi) =>
                    m.charts!.map((chart, ci) => (
                      <InlineChart key={`chart-${mi}-${ci}`} chart={chart} isDark={true} warm={warm} />
                    ))
                  )}

                {/* Action checklist from last message */}
                {(() => {
                  const lastActions = [...messages].reverse().find((m) => m.actions && m.actions.length > 0)?.actions;
                  return lastActions && lastActions.length > 0 ? (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", mb: 1 }}>
                        Plan d'action
                      </Typography>
                      <ActionChecklist
                        actions={lastActions}
                        onValidate={handleValidateActions}
                        accent="#D97757"
                        isDark={true}
                        warm={warm}
                      />
                    </Box>
                  ) : null;
                })()}

                {/* Empty state */}
                {messages.filter((m) => m.charts?.length || m.actions?.length).length === 0 && (
                  <Box sx={{ textAlign: "center", py: 8, opacity: 0.4 }}>
                    <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                      Les graphiques, resultats et actions apparaitront ici au fil de la conversation.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            {/* end RIGHT PANEL */}
          </Box>
          {/* end split layout */}
        </Box>
      </Fade>
    </>
  );
});

ChatPanel.displayName = "ChatPanel";
export default ChatPanel;
