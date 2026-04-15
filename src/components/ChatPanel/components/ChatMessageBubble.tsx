/**
 * ChatMessageBubble — Memoized message bubble with typewriter effect.
 * Extracted from ChatPanel for line count reduction.
 */
import { memo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import { useTypewriter } from "../hooks/useTypewriter";
import { ChatMarkdown, type ChatAction, type ChatChart } from "./ChatMarkdown";
import { InlineChart } from "./InlineChart";

// ── Types ──

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  thinking?: string[];
  toolsUsed?: string[];
  suggestions?: string[];
  actions?: ChatAction[];
  charts?: ChatChart[];
  isTyping?: boolean;
}

export type WarmPalette = {
  surface: string;
  surfaceHover: string;
  muted: string;
  text: string;
  border: string;
  bg: string;
  accent: string;
};

// ── Typewriter wrapper for markdown ──

const TypewriterMarkdown = ({
  content,
  isTyping,
  isDark,
  warm,
  accent,
}: {
  content: string;
  isTyping: boolean;
  isDark: boolean;
  accent: string;
  warm: WarmPalette;
}) => {
  const displayed = useTypewriter(content, isTyping, 15);
  return <ChatMarkdown content={displayed} isDark={isDark} warm={warm} accent={accent} />;
};

const ThinkingBlock = memo(({ thinking, isDark }: { thinking: string[]; isDark: boolean }) => {
  const [open, setOpen] = useState(false);
  if (!thinking || thinking.length === 0) return null;

  return (
    <Box sx={{ mb: 0.5 }}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          cursor: "pointer",
          px: 1,
          py: 0.25,
          borderRadius: 1,
          bgcolor: "rgba(255,255,255,0.03)",
          "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
          transition: "background-color 0.15s ease",
        }}
      >
        <Typography
          sx={{
            fontSize: 10,
            color: "rgba(255,255,255,0.35)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            userSelect: "none",
          }}
        >
          {open ? "▾" : "▸"} Raisonnement ({thinking.length} bloc{thinking.length > 1 ? "s" : ""})
        </Typography>
      </Box>
      <Collapse in={open}>
        <Box
          sx={{
            mt: 0.5,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            bgcolor: "rgba(255,255,255,0.02)",
            borderLeft: "2px solid rgba(255,255,255,0.08)",
            maxHeight: 300,
            overflowY: "auto",
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2 },
          }}
        >
          {thinking.map((t, i) => (
            <Typography
              key={i}
              sx={{
                fontSize: 11,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                mb: i < thinking.length - 1 ? 1 : 0,
              }}
            >
              {t.length > 800 ? t.slice(0, 800) + "..." : t}
            </Typography>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
});
ThinkingBlock.displayName = "ThinkingBlock";

const MessageBubble = memo(
  ({
    msg,
    isDark,
    warm,
    provider,
    onSuggestionClick,
    onFeedback,
  }: {
    msg: Message;
    isDark: boolean;
    provider: string;
    warm: WarmPalette;
    onSuggestionClick?: (text: string) => void;
    onFeedback?: (messageId: string, rating: number) => void;
  }) => {
    const accent = provider === "claude" ? "#D97757" : warm.accent;
    const [feedbackGiven, setFeedbackGiven] = useState<number | null>(null);
    const handleFeedback = useCallback(
      (rating: number) => {
        setFeedbackGiven(rating);
        onFeedback?.(msg.id, rating);
      },
      [msg.id, onFeedback]
    );
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: msg.role === "user" ? "row-reverse" : "row",
          gap: 1.5,
          alignItems: "flex-start",
        }}
      >
        <Box sx={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 0.75 }}>
          {/* Thinking blocks — collapsible expert mode */}
          {msg.thinking && msg.thinking.length > 0 && <ThinkingBlock thinking={msg.thinking} isDark={isDark} />}
          {/* Tools used — compact display */}
          {msg.toolsUsed && msg.toolsUsed.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25, mb: 0.25 }}>
              {msg.toolsUsed.map((tool, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.3)",
                    bgcolor: "rgba(255,255,255,0.04)",
                    px: 0.75,
                    py: 0.15,
                    borderRadius: 0.5,
                    fontFamily: "monospace",
                  }}
                >
                  {tool.length > 60 ? tool.slice(0, 60) + "..." : tool}
                </Typography>
              ))}
            </Box>
          )}
          {(msg.role === "user" || msg.content.trim()) && (
            <Box
              sx={{
                px: 2,
                py: 1.25,
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                bgcolor:
                  msg.role === "user"
                    ? isDark
                      ? "#3D3129"
                      : warm.accent
                    : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.03)",
                color: msg.role === "user" ? "#FFFFFF" : warm.text,
                boxShadow:
                  msg.role === "user" ? "none" : isDark ? "0 1px 3px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              {msg.role === "user" ? (
                <Typography
                  variant="body2"
                  sx={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {msg.content}
                </Typography>
              ) : (
                <TypewriterMarkdown
                  content={msg.content}
                  isTyping={!!msg.isTyping}
                  isDark={isDark}
                  warm={warm}
                  accent={accent}
                />
              )}
            </Box>
          )}
          {/* Feedback buttons (assistant messages only) */}
          {msg.role === "assistant" && msg.content.trim() && !msg.isTyping && onFeedback && (
            <Box
              sx={{
                display: "flex",
                gap: 0.25,
                opacity: feedbackGiven !== null ? 1 : 0.3,
                "&:hover": { opacity: 1 },
                transition: "opacity 0.15s ease",
              }}
            >
              <IconButton
                size="small"
                onClick={() => handleFeedback(1)}
                sx={{ color: feedbackGiven === 1 ? "#4CAF50" : "rgba(255,255,255,0.4)", p: 0.25 }}
              >
                {feedbackGiven === 1 ? (
                  <ThumbUpIcon sx={{ fontSize: 13 }} />
                ) : (
                  <ThumbUpOutlinedIcon sx={{ fontSize: 13 }} />
                )}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleFeedback(-1)}
                sx={{ color: feedbackGiven === -1 ? "#FF5252" : "rgba(255,255,255,0.4)", p: 0.25 }}
              >
                {feedbackGiven === -1 ? (
                  <ThumbDownIcon sx={{ fontSize: 13 }} />
                ) : (
                  <ThumbDownOutlinedIcon sx={{ fontSize: 13 }} />
                )}
              </IconButton>
            </Box>
          )}
          {/* Inline charts — only on small screens where the right artifacts panel is hidden */}
          {msg.charts && msg.charts.length > 0 && (
            <Box sx={{ display: { xs: "block", lg: "none" } }}>
              {msg.charts.map((chart, i) => (
                <InlineChart key={i} chart={chart} isDark={isDark} warm={warm} />
              ))}
            </Box>
          )}
          {/* Follow-up suggestions */}
          {msg.suggestions && msg.suggestions.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.25 }}>
              {msg.suggestions.map((s, i) => (
                <Chip
                  key={i}
                  label={s}
                  size="small"
                  onClick={() => onSuggestionClick?.(s)}
                  sx={{
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    maxWidth: "100%",
                    height: "auto",
                    "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 },
                    bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    color: accent,
                    border: `1px solid ${accent}30`,
                    "&:hover": { bgcolor: accent + "15", borderColor: accent + "50" },
                    transition: "all 0.15s ease",
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    );
  }
);
MessageBubble.displayName = "MessageBubble";

export { MessageBubble };
