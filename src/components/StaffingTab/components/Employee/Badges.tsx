import React, { memo } from "react";
import Box from "@mui/material/Box";
import { getGradeColor, SUB_TEAM_COLORS } from "../../constants";

interface GradeBadgeProps {
  grade: string | null;
}

/** Grade badge with color coding */
export const GradeBadge = memo(({ grade }: GradeBadgeProps) => {
  if (!grade) return null;
  const c = getGradeColor(grade);
  return (
    <Box
      component="span"
      sx={{
        px: 0.75,
        py: 0.25,
        fontSize: "10px",
        fontWeight: 500,
        borderRadius: 1,
        bgcolor: c.bg,
        color: c.text,
        display: "inline-block",
      }}
    >
      {grade}
    </Box>
  );
});
GradeBadge.displayName = "GradeBadge";

interface SubTeamBadgeProps {
  subTeam: string | null;
}

/** Sub-team badge with color coding */
export const SubTeamBadge = memo(({ subTeam }: SubTeamBadgeProps) => {
  if (!subTeam) return null;
  const c = SUB_TEAM_COLORS[subTeam] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <Box
      component="span"
      sx={{
        px: 0.75,
        py: 0.25,
        fontSize: "10px",
        fontWeight: 500,
        borderRadius: 1,
        bgcolor: c.bg,
        color: c.text,
        display: "inline-block",
      }}
    >
      {subTeam}
    </Box>
  );
});
SubTeamBadge.displayName = "SubTeamBadge";
