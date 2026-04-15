/**
 * CandidateDrawer — Shows ranked candidates for a selected staffing need
 *
 * Fetches candidates from the backend via GET /api/staffing/candidates,
 * displays score breakdown, and allows 1-click assignment.
 */

import { memo, useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { fetchStaffingCandidates } from "../../../../services/api";
import { getGradeColor, getGradeAbbr } from "../../constants";
import type { StaffingNeedItem } from "../../../../types";

interface CandidateDrawerProps {
  need: StaffingNeedItem;
  onClose: () => void;
  onAssign: (candidate: CandidateResult) => void;
  /** Open BulkEditPanel with prefill for advanced conflict resolution */
  onOpenEditor?: (prefill: any) => void;
  scenarioId?: string | null;
}

export interface CandidateResult {
  empId: string;
  name: string;
  grade: string;
  totalScore: number;
  gradeFit: number;
  dateOverlap: number;
  availabilityScore: number;
  skillsMatch: number;
  availablePct: number;
  availableHours: number;
  tuPct: number;
  matchedSkills: string[];
  activeAssignments: string[];
  availableFrom?: string;
  delayDays: number;
}

const ScoreBar = memo(({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
    <Typography variant="caption" sx={{ width: 32, flexShrink: 0, color: "text.secondary", fontSize: "0.65rem" }}>
      {label}
    </Typography>
    <LinearProgress
      variant="determinate"
      value={max > 0 ? (value / max) * 100 : 0}
      sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: "grey.100", "& .MuiLinearProgress-bar": { bgcolor: color } }}
    />
    <Typography variant="caption" sx={{ width: 18, textAlign: "right", fontSize: "0.65rem", fontWeight: 600 }}>
      {value}
    </Typography>
  </Box>
));
ScoreBar.displayName = "ScoreBar";

const CandidateDrawer = memo(({ need, onClose, onAssign, scenarioId }: CandidateDrawerProps) => {
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStaffingCandidates({
      needId: need.id,
      grade: need.grade,
      skills: need.skills,
      periodStart: need.startDate,
      periodEnd: need.endDate,
      maxGradeDistance: 2,
      periodTolerance: 1,
    })
      .then((data) => {
        if (!cancelled) setCandidates(data.candidates || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [need.id, need.grade, need.skills, need.startDate, need.endDate]);

  const handleAssign = useCallback(
    (candidate: CandidateResult) => {
      onAssign(candidate);
    },
    [onAssign]
  );

  return (
    <Box
      sx={{
        width: 340,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
        <PersonAddIcon fontSize="small" color="primary" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            Candidates
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {need.grade} &middot; {need.startDate?.slice(5)} → {need.endDate?.slice(5)}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Typography variant="body2" color="error" sx={{ p: 2, textAlign: "center" }}>
            {error}
          </Typography>
        )}

        {!loading && !error && candidates.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            No matching candidates found.
          </Typography>
        )}

        {!loading &&
          candidates.slice(0, 8).map((c) => {
            const gradeColor = getGradeColor(c.grade);
            return (
              <Box
                key={c.empId}
                sx={{
                  p: 1,
                  mb: 0.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: "divider",
                  "&:hover": { bgcolor: "action.hover" },
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                }}
              >
                {/* Name + Grade + Score */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Chip
                    label={getGradeAbbr(c.grade)}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      "& .MuiChip-label": { px: 0.5 },
                      bgcolor: gradeColor.bg,
                      color: gradeColor.text,
                    }}
                  />
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, fontSize: "0.8rem" }} noWrap>
                    {c.name}
                  </Typography>
                  <Tooltip title={`Score: ${c.totalScore}/100`}>
                    <Box
                      sx={{
                        px: 0.75,
                        py: 0.15,
                        borderRadius: 1,
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        bgcolor: c.totalScore >= 70 ? "#dcfce7" : c.totalScore >= 40 ? "#fef9c3" : "#fee2e2",
                        color: c.totalScore >= 70 ? "#166534" : c.totalScore >= 40 ? "#854d0e" : "#991b1b",
                      }}
                    >
                      {c.totalScore}
                    </Box>
                  </Tooltip>
                </Box>

                {/* Score breakdown */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.15 }}>
                  <ScoreBar label="Grade" value={c.gradeFit} max={30} color="#8b5cf6" />
                  <ScoreBar label="Dates" value={c.dateOverlap} max={25} color="#3b82f6" />
                  <ScoreBar label="Avail." value={c.availabilityScore} max={25} color="#10b981" />
                  <ScoreBar label="Skills" value={c.skillsMatch} max={15} color="#f59e0b" />
                </Box>

                {/* Info line */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                    TU {c.tuPct?.toFixed(0)}% &middot; Avail. {c.availablePct?.toFixed(0)}%
                  </Typography>
                  {c.delayDays > 0 && (
                    <Chip
                      label={`+${c.delayDays}d`}
                      size="small"
                      sx={{ height: 16, fontSize: "0.6rem", bgcolor: "#fef3c7", color: "#92400e" }}
                    />
                  )}
                  {c.matchedSkills?.length > 0 && (
                    <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "#f59e0b" }}>
                      {c.matchedSkills.length} skill{c.matchedSkills.length > 1 ? "s" : ""}
                    </Typography>
                  )}
                </Box>

                {/* Assign button — with conflict detection */}
                {(() => {
                  const needUtil = need.utilization ?? 100;
                  const hasConflict = c.availablePct < needUtil;
                  return (
                    <Box sx={{ display: "flex", gap: 0.5, mt: 0.25, alignItems: "center" }}>
                      {hasConflict && (
                        <Tooltip
                          title={`Available ${c.availablePct?.toFixed(0)}% < needed ${needUtil}%. Opens editor to resolve conflicts.`}
                        >
                          <WarningAmberIcon sx={{ fontSize: 14, color: "warning.main" }} />
                        </Tooltip>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        color={hasConflict ? "warning" : "primary"}
                        onClick={() => handleAssign(c)}
                        sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
                      >
                        Assign
                      </Button>
                    </Box>
                  );
                })()}
              </Box>
            );
          })}
      </Box>
    </Box>
  );
});
CandidateDrawer.displayName = "CandidateDrawer";

export default CandidateDrawer;
