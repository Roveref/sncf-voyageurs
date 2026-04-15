import React, { memo } from "react";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { SKILL_CATEGORY_THEME, SKILL_LEVEL_THEME } from "../../constants/theme";

interface Skill {
  category: string;
  level: number;
  skillFull: string;
  skillShort: string;
}

interface SkillChipProps {
  skill: Skill;
  size?: "xs" | "sm";
}

export const SkillChip = memo(({ skill, size = "sm" }: SkillChipProps) => {
  const theme = SKILL_CATEGORY_THEME[skill.category] || { bg: "#f3f4f6", text: "#374151", hex: "#9ca3af" };
  const levelTheme = SKILL_LEVEL_THEME[skill.level] || SKILL_LEVEL_THEME[0];
  const isXs = size === "xs";

  return (
    <Box
      component="span"
      title={`${skill.skillFull} — ${levelTheme.label} (${skill.level}/4)`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        px: isXs ? 0.5 : 0.75,
        py: isXs ? 0 : 0.25,
        fontSize: isXs ? "8px" : "10px",
        fontWeight: 500,
        borderRadius: 1,
        bgcolor: theme.hex ? `${theme.hex}20` : "#f3f4f6",
        color: theme.hex || "#374151",
      }}
    >
      {skill.skillShort}
      <Typography component="span" sx={{ fontSize: isXs ? "7px" : "9px", opacity: 0.6 }}>
        {skill.level}
      </Typography>
    </Box>
  );
});
SkillChip.displayName = "SkillChip";
