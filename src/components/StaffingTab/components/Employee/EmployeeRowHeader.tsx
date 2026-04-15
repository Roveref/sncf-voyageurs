import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Chip from "@mui/material/Chip";
import { getGradeAbbr, getGradeColor } from "../../constants";
import {
  AlertDots,
  FragBadge,
  TransitionLossBadge,
  GradeTransitionBadge,
  EtpBadge,
  PotentialBadge,
  TeamContribBadge,
  SapCompletionBadge,
} from "./EmployeeRowBadges";
import {
  SX_FLEX_CENTER_GAP05,
  SX_CHEVRON_ICON,
  SX_NAME_TYPO,
  SX_GRADE_CHIP_BASE,
  SX_TEAM_CHIP,
  SX_FLEX_1,
  SX_BADGES_ROW,
  SX_BADGE_BASE,
  SX_TU_CLICK,
  SX_METRIC_TYPO,
  SX_IO_INLINE,
  SX_MERGED_GRADE_BOX,
  SX_GRADE_ARROW,
} from "./employeeRowStyles";

interface EmployeeRowHeaderProps {
  employee: any;
  collapsed: boolean;
  showDetails: boolean;
  showUtilization: boolean;
  showIO: string;
  currentEtp: any;
  gradeTransition: any;
  teamContribPts: number;
  teamNetHours: number;
  chargeableH: number;
  potentialTeamPts: number;
  sapCompletion: any;
  tuTooltip: string;
  metricText: string;
  onToggle: () => void;
  onNameClick: ((e: React.MouseEvent) => void) | undefined;
  onTuClick: () => void;
  hasNameClickHandler: boolean;
  isRecruit: boolean;
  ioTU: number | null | undefined;
}

const EmployeeRowHeader = memo(
  ({
    employee,
    collapsed,
    showDetails,
    showUtilization,
    showIO,
    currentEtp,
    gradeTransition,
    teamContribPts,
    teamNetHours,
    chargeableH,
    potentialTeamPts,
    sapCompletion,
    tuTooltip,
    metricText,
    onToggle,
    onNameClick,
    onTuClick,
    hasNameClickHandler,
    isRecruit,
    ioTU,
  }: EmployeeRowHeaderProps) => {
    const ChevronIcon = collapsed ? ChevronRightIcon : ExpandMoreIcon;
    const chevronLabel = collapsed ? "Expand employee details" : "Collapse employee details";

    return (
      <Box sx={SX_FLEX_CENTER_GAP05}>
        <ChevronIcon aria-label={chevronLabel} sx={SX_CHEVRON_ICON} onClick={onToggle} />
        <Typography
          component="span"
          role="button"
          aria-label={employee.name}
          sx={{
            ...SX_NAME_TYPO,
            cursor: hasNameClickHandler ? "pointer" : undefined,
            "&:hover": {},
          }}
          onClick={onNameClick}
        >
          {employee.name}
        </Typography>
        {showDetails &&
          employee.grade &&
          (() => {
            const isMergedGrade = employee._gradeHistory?.length > 1 && !employee._isGradeSplit;
            if (isMergedGrade) {
              const history = employee._gradeHistory;
              const firstGrade = history[0].grade;
              const lastGrade = history[history.length - 1].grade;
              const gc0 = getGradeColor(firstGrade);
              const gc1 = getGradeColor(lastGrade);
              return (
                <Box sx={SX_MERGED_GRADE_BOX}>
                  <Chip
                    label={getGradeAbbr(firstGrade)}
                    size="small"
                    title={firstGrade}
                    sx={{ ...SX_GRADE_CHIP_BASE, bgcolor: gc0.bg, color: gc0.text }}
                  />
                  <Typography sx={SX_GRADE_ARROW}>&rarr;</Typography>
                  <Chip
                    label={getGradeAbbr(lastGrade)}
                    size="small"
                    title={lastGrade}
                    sx={{ ...SX_GRADE_CHIP_BASE, bgcolor: gc1.bg, color: gc1.text }}
                  />
                </Box>
              );
            }
            const gc = getGradeColor(employee.grade);
            return (
              <Chip
                label={getGradeAbbr(employee.grade)}
                size="small"
                title={employee.grade}
                sx={{ ...SX_GRADE_CHIP_BASE, bgcolor: gc.bg, color: gc.text }}
              />
            );
          })()}
        {showDetails && (employee.subTeam || employee.serviceLine) && (
          <Chip label={employee.subTeam || employee.serviceLine} size="small" sx={SX_TEAM_CHIP} />
        )}
        <Box sx={SX_FLEX_1} />
        <Box sx={SX_BADGES_ROW}>
          {isRecruit && (
            <Box
              component="span"
              title="Hired from recruitment"
              sx={{
                ...SX_BADGE_BASE,
                bgcolor: alpha("#10b981", 0.1),
                color: "#059669",
              }}
            >
              Recruit
            </Box>
          )}
          {showDetails && <EtpBadge currentEtp={currentEtp} />}
          {showDetails && <GradeTransitionBadge gradeTransition={gradeTransition} />}
          {showDetails && (
            <TeamContribBadge teamContribPts={teamContribPts} chargeableH={chargeableH} teamNetHours={teamNetHours} />
          )}
          {showDetails && <PotentialBadge potentialTeamPts={potentialTeamPts} />}
          {showDetails && <SapCompletionBadge sapCompletion={sapCompletion} />}
          {showUtilization && (
            <Tooltip
              title={<span style={{ whiteSpace: "pre-line", fontSize: "0.7rem" }}>{tuTooltip}</span>}
              arrow
              placement="left"
            >
              <Box onClick={onTuClick} role="button" aria-label="View utilization details" sx={SX_TU_CLICK}>
                <Typography component="span" sx={SX_METRIC_TYPO}>
                  {metricText}
                  {showIO === "show" && ioTU != null && (
                    <Typography component="span" sx={SX_IO_INLINE}>
                      (I&O {ioTU.toFixed(1)}%)
                    </Typography>
                  )}
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  }
);

EmployeeRowHeader.displayName = "EmployeeRowHeader";

export { EmployeeRowHeader };
