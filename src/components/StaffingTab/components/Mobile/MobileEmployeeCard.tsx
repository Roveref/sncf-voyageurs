import { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { alpha, useTheme } from "@mui/material/styles";
import { getGradeColor, getGradeAbbr } from "../../constants";
import type { Employee } from "../../types";

interface MobileEmployeeCardProps {
  employee: Employee;
  tuRate: number | null;
  onClick: (emp: Employee) => void;
}

/** Colour thresholds for TU display */
const getTuColor = (tu: number | null): string => {
  if (tu == null) return "#999";
  if (tu >= 85) return "#10B981";
  if (tu >= 65) return "#F59E0B";
  return "#EF4444";
};

const MobileEmployeeCard = memo(({ employee, tuRate, onClick }: MobileEmployeeCardProps) => {
  const theme = useTheme();
  const gradeColor = String(getGradeColor(employee.grade));
  const gradeAbbr = getGradeAbbr(employee.grade);
  const tuDisplay = tuRate != null ? `${Math.round(tuRate)}%` : "-";
  const tuColor = getTuColor(tuRate);

  return (
    <Box
      onClick={() => onClick(employee)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        mx: 0.5,
        mb: 0.75,
        borderRadius: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        minHeight: 64,
        "&:active": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
      }}
    >
      {/* Grade badge */}
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          bgcolor: alpha(gradeColor, 0.15),
          color: gradeColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: "0.7rem",
          flexShrink: 0,
          border: `2px solid ${alpha(gradeColor, 0.3)}`,
        }}
      >
        {gradeAbbr}
      </Box>

      {/* Name + team */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap sx={{ lineHeight: 1.3 }}>
          {employee.name}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
          {employee.grade && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
              {employee.grade}
            </Typography>
          )}
          {employee.subTeam && (
            <>
              <Typography variant="caption" color="text.disabled">
                /
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.65rem" }}>
                {employee.subTeam}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* TU % */}
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            fontSize: "1.1rem",
            color: tuColor,
            lineHeight: 1,
          }}
        >
          {tuDisplay}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6rem" }}>
          TU
        </Typography>
      </Box>

      <ChevronRightIcon sx={{ fontSize: 20, color: "text.disabled", flexShrink: 0 }} />
    </Box>
  );
});
MobileEmployeeCard.displayName = "MobileEmployeeCard";

export default MobileEmployeeCard;
