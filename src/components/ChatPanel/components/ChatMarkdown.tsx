import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── Types ──

interface ChatAction {
  label: string;
  action: string;
  data: Record<string, unknown>;
}

interface ChatChart {
  chartType: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  unit?: string;
}

// ── Helpers ──

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as any).props.children);
  }
  return "";
}

// ── Smart cell renderers ──

/** Detect and render scores like "90/100" as progress bar */
function renderSmartCell(text: string, isDark: boolean, accent: string): React.ReactNode {
  const str = String(text).trim();

  // Score pattern: "90/100"
  const scoreMatch = str.match(/^(\d+)\s*\/\s*100$/);
  if (scoreMatch) {
    const val = parseInt(scoreMatch[1]);
    const color = val >= 80 ? "#4caf50" : val >= 60 ? "#ff9800" : "#f44336";
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 90 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color, minWidth: 28 }}>{val}</Typography>
        <Box
          sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}
        >
          <Box
            sx={{ width: `${val}%`, height: "100%", borderRadius: 3, bgcolor: color, transition: "width 0.5s ease" }}
          />
        </Box>
      </Box>
    );
  }

  // TU/Dispo percentage pattern: "78%" or "78,6%" or "100%"
  const pctMatch = str.match(/^(\d+[,.]?\d*)\s*%$/);
  if (pctMatch) {
    const val = parseFloat(pctMatch[1].replace(",", "."));
    const color =
      val >= 80
        ? "#4caf50"
        : val >= 50
          ? "#ff9800"
          : val > 0
            ? "#f44336"
            : isDark
              ? "rgba(255,255,255,0.3)"
              : "rgba(0,0,0,0.25)";
    return (
      <Chip
        label={str}
        size="small"
        sx={{
          height: 22,
          fontSize: 11,
          fontWeight: 600,
          bgcolor: color + "18",
          color,
          border: `1px solid ${color}40`,
        }}
      />
    );
  }

  // Availability pattern: "308h (78,6%)" or "204h (52%)"
  const availMatch = str.match(/^(\d+)h\s*\((\d+[,.]?\d*)%\)$/);
  if (availMatch) {
    const hours = availMatch[1];
    const pct = parseFloat(availMatch[2].replace(",", "."));
    const color = pct >= 75 ? "#4caf50" : pct >= 40 ? "#ff9800" : "#f44336";
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box
          sx={{
            width: 40,
            height: 6,
            borderRadius: 3,
            bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          }}
        >
          <Box sx={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 3, bgcolor: color }} />
        </Box>
        <Typography sx={{ fontSize: 11.5 }}>{hours}h</Typography>
      </Box>
    );
  }

  return null; // fallback to default rendering
}

/** Parse structured blocks from AI response text */
function parseStructuredBlocks(text: string): {
  cleanText: string;
  suggestions?: string[];
  actions?: ChatAction[];
  charts?: ChatChart[];
} {
  let cleanText = text;
  let suggestions: string[] | undefined;
  let actions: ChatAction[] | undefined;
  const charts: ChatChart[] = [];

  // Parse suggestions. Markers tolerate any whitespace (newline OR space) after the tag —
  // the LLM doesn't always put a newline. Fall back to splitting on '?' if all suggestions
  // landed on a single line.
  const sugMatch = cleanText.match(/---suggestions\s+([\s\S]*?)---/);
  if (sugMatch) {
    const raw = sugMatch[1].trim();
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
    cleanText = cleanText.replace(sugMatch[0], "");
  }

  // Parse actions
  const actMatch = cleanText.match(/---actions\s+([\s\S]*?)---/);
  if (actMatch) {
    try {
      actions = JSON.parse(actMatch[1].trim());
    } catch {
      /* skip malformed */
    }
    cleanText = cleanText.replace(actMatch[0], "");
  }

  // Parse charts (can be multiple)
  let chartMatch;
  const chartRegex = /---chart\s+([\s\S]*?)---/g;
  while ((chartMatch = chartRegex.exec(cleanText)) !== null) {
    try {
      const parsed = JSON.parse(chartMatch[1].trim());
      charts.push({ chartType: parsed.type, title: parsed.title || "", data: parsed.data, unit: parsed.unit });
    } catch {
      /* skip */
    }
  }
  cleanText = cleanText.replace(/---chart\s+[\s\S]*?---/g, "");

  return {
    cleanText: cleanText.trim(),
    suggestions: suggestions && suggestions.length > 0 ? suggestions : undefined,
    actions: actions && actions.length > 0 ? actions : undefined,
    charts: charts.length > 0 ? charts : undefined,
  };
}

// ── Markdown renderer component ──

const ChatMarkdown = memo(
  ({
    content,
    isDark,
    warm,
    accent,
  }: {
    content: string;
    isDark: boolean;
    accent: string;
    warm: { surface: string; surfaceHover: string; muted: string; text: string; border: string; bg: string };
  }) => (
    <Box
      sx={{
        fontSize: 13,
        lineHeight: 1.7,
        wordBreak: "break-word",
        color: warm.text,
        "& p": { m: 0, mb: 1, "&:last-child": { mb: 0 } },
        "& h1, & h2": {
          mt: 2,
          mb: 1,
          fontWeight: 700,
          lineHeight: 1.3,
          fontSize: 16,
          borderBottom: `1px solid ${warm.border}`,
          pb: 0.5,
        },
        "& h3": { mt: 1.5, mb: 0.75, fontWeight: 700, fontSize: 14.5, lineHeight: 1.3 },
        "& h4": { mt: 1, mb: 0.5, fontWeight: 600, fontSize: 13.5, lineHeight: 1.3 },
        "& strong": { fontWeight: 700 },
        "& em": { fontStyle: "italic" },
        "& ul, & ol": { pl: 2.5, my: 0.75 },
        "& li": { mb: 0.5, "& p": { mb: 0 } },
        "& hr": { border: "none", borderTop: `1px solid ${warm.border}`, my: 2 },
        "& blockquote": {
          borderLeft: `3px solid ${accent}`,
          borderRadius: "0 8px 8px 0",
          bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          pl: 2,
          pr: 1.5,
          py: 1,
          ml: 0,
          my: 1.5,
          "& p": { color: warm.muted, fontSize: 12.5 },
        },
        "& code": {
          bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
          px: 0.75,
          py: 0.15,
          borderRadius: "4px",
          fontSize: 12,
          fontFamily: "'SF Mono', Monaco, monospace",
        },
        "& pre": {
          bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
          borderRadius: "8px",
          p: 1.5,
          my: 1,
          overflow: "auto",
          "& code": { bgcolor: "transparent", px: 0, py: 0 },
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <Box
              sx={{
                my: 1.5,
                borderRadius: "10px",
                overflow: "hidden",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>{children}</table>
            </Box>
          ),
          thead: ({ children }) => (
            <thead
              style={{
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              }}
            >
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th
              style={{
                textAlign: "left",
                padding: "8px 12px",
                fontWeight: 600,
                fontSize: 11.5,
                color: warm.muted,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                borderBottom: `2px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => {
            const text = extractText(children);
            const smart = renderSmartCell(text, isDark, accent);
            return (
              <td
                style={{
                  padding: "7px 12px",
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                }}
              >
                {smart || children}
              </td>
            );
          },
          tr: ({ children, ...props }) => {
            const isBody = !(props as any).isHeader;
            return (
              <tr
                style={
                  isBody
                    ? {
                        transition: "background 0.15s",
                      }
                    : undefined
                }
                onMouseEnter={
                  isBody
                    ? (e) => {
                        (e.currentTarget as HTMLElement).style.background = isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.015)";
                      }
                    : undefined
                }
                onMouseLeave={
                  isBody
                    ? (e) => {
                        (e.currentTarget as HTMLElement).style.background = "";
                      }
                    : undefined
                }
              >
                {children}
              </tr>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  )
);
ChatMarkdown.displayName = "ChatMarkdown";

export { ChatMarkdown, extractText, renderSmartCell, parseStructuredBlocks };
export type { ChatAction, ChatChart };
