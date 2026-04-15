import { memo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// ── Component ──

const StepsAccordion = memo(
  ({
    label,
    items,
    icon,
    isDark,
    warm,
  }: {
    label: string;
    items: string[];
    icon: string;
    isDark: boolean;
    warm: { surface: string; surfaceHover: string; muted: string; text: string; border: string };
  }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          border: `1px solid ${warm.border}`,
          overflow: "hidden",
        }}
      >
        <Box
          onClick={() => setExpanded(!expanded)}
          sx={{
            px: 1.5,
            py: 0.75,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            cursor: "pointer",
            "&:hover": { bgcolor: warm.surfaceHover },
            transition: "background-color 0.15s ease",
          }}
        >
          <Typography sx={{ fontSize: 12 }}>{icon}</Typography>
          <Typography variant="caption" sx={{ color: warm.muted, fontWeight: 500, flex: 1, fontSize: 11 }}>
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: 10,
              color: warm.muted,
              transition: "transform 0.2s",
              transform: expanded ? "rotate(180deg)" : "none",
            }}
          >
            ▼
          </Typography>
        </Box>
        {expanded && (
          <Box sx={{ px: 1.5, pb: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {items.map((item, i) => (
              <Typography
                key={i}
                variant="caption"
                sx={{
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: warm.muted,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: item.startsWith("SQL:") ? "monospace" : "inherit",
                  bgcolor: item.startsWith("SQL:")
                    ? isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.03)"
                    : "transparent",
                  borderRadius: 1,
                  px: item.startsWith("SQL:") ? 1 : 0,
                  py: item.startsWith("SQL:") ? 0.5 : 0,
                  // Truncate long thinking blocks
                  maxHeight: 120,
                  overflow: "auto",
                }}
              >
                {item}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    );
  }
);
StepsAccordion.displayName = "StepsAccordion";

export { StepsAccordion };
