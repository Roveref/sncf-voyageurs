/**
 * NeedsPyramid — Grade pyramid visualization for staffing needs.
 * Shows BearingPoint grades with count badges and click-to-add behavior.
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import { getGradeColor } from "../StaffingTab/constants";
import { easing } from "../../styles/animations";

interface NeedsPyramidProps {
  validGrades: string[];
  mPlusSet: Set<string>;
  countPerGrade: Record<string, { added: number; existing: number }>;
  allNeeds: any[];
  formDatesValid: boolean;
  editingGrade: string | null;
  hoveredGrade: string | null;
  onGradeClick: (grade: string) => void;
  onHoverGrade: (grade: string | null) => void;
  computeWorkingDays: (s: string, e: string) => number;
  width: number;
}

const NeedsPyramid = memo(
  ({
    validGrades,
    mPlusSet,
    countPerGrade,
    allNeeds,
    formDatesValid,
    editingGrade,
    hoveredGrade,
    onGradeClick,
    onHoverGrade,
    computeWorkingDays,
    width,
  }: NeedsPyramidProps) => {
    const elegantT = `all 0.3s ${easing.elegant}`;

    return (
      <Box sx={{ width, flexShrink: 0 }}>
        <Typography
          variant="caption"
          fontWeight={700}
          color="text.secondary"
          sx={{ mb: 0.75, display: "block", textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.62rem" }}
        >
          Profiles
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.4 }}>
          {validGrades.map((grade, i) => {
            const gc = getGradeColor(grade);
            const counts = countPerGrade[grade] || { added: 0, existing: 0 };
            const count = counts.added + counts.existing;
            const isFirstMm = i > 0 && !mPlusSet.has(grade) && mPlusSet.has(validGrades[i - 1]);
            const isEditing = editingGrade === grade;
            const baseW = 55 + (i / Math.max(validGrades.length - 1, 1)) * 45;
            const widthPct = count > 0 ? Math.min(100, baseW + 8) : baseW;
            const gradeNeeds = allNeeds.filter((n) => n.grade === grade);
            const tooltipText =
              gradeNeeds.length > 0
                ? gradeNeeds
                    .map(
                      (n) =>
                        `${n.startDate} \u2192 ${n.endDate} (${computeWorkingDays(n.startDate, n.endDate)}j)${n.preferredPerson ? ` \u00b7 ${n.preferredPerson}` : ""}`
                    )
                    .join("\n")
                : formDatesValid
                  ? "Click to add"
                  : "Select to assign";

            return (
              <React.Fragment key={grade}>
                {isFirstMm && (
                  <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 0.5, my: 0.15 }}>
                    <Divider sx={{ flex: 1 }} />
                    <Typography
                      variant="caption"
                      sx={{ color: "text.disabled", fontWeight: 600, fontSize: "0.55rem", letterSpacing: 0.5 }}
                    >
                      M+/M\u2212
                    </Typography>
                    <Divider sx={{ flex: 1 }} />
                  </Box>
                )}
                <Tooltip title={tooltipText} placement="right" arrow enterDelay={300}>
                  <Box sx={{ width: `${widthPct}%`, transition: elegantT }}>
                    <Box
                      onClick={() => onGradeClick(grade)}
                      onMouseEnter={() => onHoverGrade(grade)}
                      onMouseLeave={() => onHoverGrade(null)}
                      sx={{
                        height: 28,
                        bgcolor: alpha(gc.border, isEditing ? 0.3 : count > 0 ? 0.2 : 0.06),
                        borderRadius: "14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.5,
                        cursor: "pointer",
                        transition: elegantT,
                        outline: isEditing ? `2px solid ${gc.border}` : "none",
                        outlineOffset: 1,
                        "&:hover": { bgcolor: alpha(gc.border, isEditing ? 0.35 : count > 0 ? 0.3 : 0.12) },
                      }}
                    >
                      {count > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                          {counts.existing > 0 && (
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                bgcolor: alpha(gc.border, 0.4),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Typography sx={{ fontSize: "0.55rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                                {counts.existing}
                              </Typography>
                            </Box>
                          )}
                          {counts.added > 0 && (
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                bgcolor: alpha(gc.border, 0.9),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Typography sx={{ fontSize: "0.55rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                                {counts.added}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, color: gc.text, fontSize: "0.72rem", whiteSpace: "nowrap" }}
                      >
                        {grade}
                      </Typography>
                    </Box>
                  </Box>
                </Tooltip>
              </React.Fragment>
            );
          })}
        </Box>
      </Box>
    );
  }
);

NeedsPyramid.displayName = "NeedsPyramid";

export default NeedsPyramid;
