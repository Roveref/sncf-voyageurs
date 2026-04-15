import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface SkillTagsData {
  required: string[];
  matched: string[];
  matchPct?: number;
}

interface SkillTagsProps {
  title: string;
  data: SkillTagsData;
  isDark: boolean;
  warm: { surface: string; border: string; muted: string; text: string };
}

const SkillTags = memo(({ title, data, isDark, warm }: SkillTagsProps) => {
  const matchedSet = new Set(data.matched.map((s) => s.toLowerCase()));
  const pct =
    data.matchPct ?? (data.required.length > 0 ? Math.round((data.matched.length / data.required.length) * 100) : 0);
  const pctColor = pct >= 75 ? "#4caf50" : pct >= 50 ? "#ff9800" : "#f44336";

  return (
    <Box
      sx={{
        my: 1,
        p: 1.5,
        borderRadius: 2,
        bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
        border: `1px solid ${warm.border}`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: warm.text }}>{title}</Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: pctColor }}>
          {data.matched.length}/{data.required.length} ({pct}%)
        </Typography>
      </Box>

      {/* Tags */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
        {data.required.map((skill, i) => {
          const isMatched = matchedSet.has(skill.toLowerCase());
          return (
            <Box
              key={i}
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: "6px",
                fontSize: 11,
                fontWeight: 600,
                bgcolor: isMatched ? "#4caf5018" : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                color: isMatched ? "#4caf50" : warm.muted,
                border: `1px solid ${isMatched ? "#4caf5040" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                textDecoration: isMatched ? "none" : "line-through",
                opacity: isMatched ? 1 : 0.6,
              }}
            >
              {skill}
            </Box>
          );
        })}
      </Box>

      {/* Match bar */}
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
        <Box
          sx={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 3,
            bgcolor: pctColor,
            transition: "width 0.5s ease",
          }}
        />
      </Box>
    </Box>
  );
});
SkillTags.displayName = "SkillTags";

export { SkillTags };
