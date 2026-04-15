import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface CandidateData {
  name: string;
  grade: string;
  totalScore: number;
  gradeFit?: number;
  dateOverlap?: number;
  availability?: number;
  skills?: number;
  availableHours?: number;
  availablePct?: number;
  availableFrom?: string;
  delayDays?: number;
  matchedSkills?: string[];
  tuPct?: number;
}

interface CandidateCardsProps {
  title: string;
  data: CandidateData[];
  isDark: boolean;
  warm: { surface: string; border: string; muted: string; text: string };
}

const DIMENSIONS = [
  { key: "gradeFit" as const, label: "Grade", max: 30 },
  { key: "dateOverlap" as const, label: "Period", max: 25 },
  { key: "availability" as const, label: "Avail.", max: 25 },
  { key: "skills" as const, label: "Skills", max: 15 },
];

function scoreColor(val: number, max: number): string {
  const pct = (val / max) * 100;
  return pct >= 80 ? "#4caf50" : pct >= 50 ? "#ff9800" : "#f44336";
}

function totalColor(score: number): string {
  return score >= 75 ? "#4caf50" : score >= 50 ? "#ff9800" : "#f44336";
}

const CandidateCards = memo(({ title, data, isDark, warm }: CandidateCardsProps) => (
  <Box sx={{ my: 1 }}>
    <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1, color: warm.text }}>{title}</Typography>
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {data.map((c, i) => (
        <Box
          key={i}
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            border: `1px solid ${warm.border}`,
          }}
        >
          {/* Header: rank + name + grade + score */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: warm.muted, minWidth: 16 }}>{i + 1}.</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: warm.text, flex: 1 }}>{c.name}</Typography>
            <Box
              sx={{
                px: 0.75,
                py: 0.15,
                borderRadius: "4px",
                bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                fontSize: 10.5,
                fontWeight: 700,
                color: warm.muted,
              }}
            >
              {c.grade}
            </Box>
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: "10px",
                bgcolor: totalColor(c.totalScore) + "18",
                border: `1px solid ${totalColor(c.totalScore)}40`,
                fontSize: 12,
                fontWeight: 700,
                color: totalColor(c.totalScore),
              }}
            >
              {c.totalScore}/100
            </Box>
          </Box>

          {/* Score breakdown bars */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, mb: 1 }}>
            {DIMENSIONS.map((dim) => {
              const val = c[dim.key] ?? 0;
              return (
                <Box key={dim.key} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Typography sx={{ fontSize: 10, color: warm.muted, minWidth: 42, textAlign: "right" }}>
                    {dim.label}
                  </Typography>
                  <Box
                    sx={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(val / dim.max) * 100}%`,
                        height: "100%",
                        borderRadius: 3,
                        bgcolor: scoreColor(val, dim.max),
                        transition: "width 0.5s ease",
                      }}
                    />
                  </Box>
                  <Typography
                    sx={{ fontSize: 10, fontWeight: 600, color: warm.text, minWidth: 30, textAlign: "right" }}
                  >
                    {val}/{dim.max}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Footer: availability + skills */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
            {c.availableHours != null && (
              <Typography sx={{ fontSize: 10.5, color: warm.muted }}>
                Avail: {c.availableHours}h{c.availablePct != null ? ` (${c.availablePct}%)` : ""}
              </Typography>
            )}
            {c.tuPct != null && <Typography sx={{ fontSize: 10.5, color: warm.muted }}>TU: {c.tuPct}%</Typography>}
            {c.availableFrom && (
              <Typography sx={{ fontSize: 10.5, color: "#ff9800" }}>
                Available from {c.availableFrom}
                {c.delayDays ? ` (+${c.delayDays}d)` : ""}
              </Typography>
            )}
            {c.matchedSkills && c.matchedSkills.length > 0 && (
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {c.matchedSkills.map((s, si) => (
                  <Box
                    key={si}
                    sx={{
                      px: 0.75,
                      py: 0.1,
                      borderRadius: "4px",
                      bgcolor: "#4caf5018",
                      border: "1px solid #4caf5040",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#4caf50",
                    }}
                  >
                    {s}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
));
CandidateCards.displayName = "CandidateCards";

export { CandidateCards };
