/**
 * NeedsTimeline — Gantt-style timeline for staffing needs.
 * Shows bars sorted by grade with month columns and today line.
 */

import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { getGradeColor, getGradeAbbr } from "../StaffingTab/constants";
import { easing } from "../../styles/animations";

interface NeedItem {
  id: string;
  grade: string;
  startDate: string;
  endDate: string;
  skills: string[];
  utilization: number;
  preferredPerson?: string;
  _existing?: boolean;
}

interface MonthColumn {
  label: string;
  widthPct: number;
}

interface GanttRange {
  minDate: string;
  maxDate: string;
  totalDays: number;
}

interface NeedsTimelineProps {
  sortedNeeds: NeedItem[];
  allNeeds: NeedItem[];
  existingNeedsCount: number;
  addedNeedsCount: number;
  totalWorkingDays: number;
  ganttRange: GanttRange;
  monthColumns: MonthColumn[];
  todayPct: number | null;
  hoveredGrade: string | null;
  editingNeedId: string | null;
  lastAddedId: string | null;
  formDatesValid: boolean;
  onClickNeed: (need: NeedItem) => void;
  onClickExistingNeed: (need: NeedItem) => void;
  onRemoveNeed: (id: string) => void;
  computeWorkingDays: (s: string, e: string) => number;
}

const flashAddKf = {
  "@keyframes flashAdd": {
    "0%": { boxShadow: "0 0 0 0 rgba(76,175,80,0.7)" },
    "40%": { boxShadow: "0 0 12px 4px rgba(76,175,80,0.35)" },
    "100%": { boxShadow: "none" },
  },
};

const NeedsTimeline = memo(
  ({
    sortedNeeds,
    allNeeds,
    existingNeedsCount,
    addedNeedsCount,
    totalWorkingDays,
    ganttRange,
    monthColumns,
    todayPct,
    hoveredGrade,
    editingNeedId,
    lastAddedId,
    formDatesValid,
    onClickNeed,
    onClickExistingNeed,
    onRemoveNeed,
    computeWorkingDays,
  }: NeedsTimelineProps) => {
    const theme = useTheme();
    const elegantT = `all 0.3s ${easing.elegant}`;

    return (
      <Box sx={{ flex: 1, minWidth: 0, position: "relative", alignSelf: "stretch" }}>
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
          {/* Header with summary */}
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5, flexShrink: 0 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontSize: "0.62rem" }}
            >
              Timeline
            </Typography>
            {allNeeds.length > 0 && (
              <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ fontSize: "0.6rem" }}>
                {existingNeedsCount > 0 ? `${existingNeedsCount} existing + ` : ""}
                {addedNeedsCount} new \u00b7 {totalWorkingDays}d
              </Typography>
            )}
          </Box>

          {allNeeds.length > 0 && ganttRange.totalDays > 0 ? (
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              {/* Month axis */}
              <Box
                sx={{ display: "flex", mb: 0.25, position: "sticky", top: 0, bgcolor: "background.default", zIndex: 1 }}
              >
                {monthColumns.map((col, ci) => (
                  <Box
                    key={ci}
                    sx={{
                      width: `${col.widthPct}%`,
                      textAlign: "center",
                      borderRight:
                        ci < monthColumns.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : "none",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: "0.58rem", color: "text.disabled", fontWeight: 600 }}>
                      {col.label}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Bars container (with today line) */}
              <Box sx={{ position: "relative" }}>
                {/* Today line */}
                {todayPct !== null && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${todayPct}%`,
                      width: 1.5,
                      bgcolor: theme.palette.error.main,
                      opacity: 0.5,
                      zIndex: 2,
                      pointerEvents: "none",
                      "&::before": {
                        content: '"Today"',
                        position: "absolute",
                        top: -14,
                        left: -10,
                        fontSize: "0.45rem",
                        fontWeight: 700,
                        color: theme.palette.error.main,
                        whiteSpace: "nowrap",
                      },
                    }}
                  />
                )}

                {/* Bars -- sorted by grade */}
                {sortedNeeds.map((need) => {
                  const gc = getGradeColor(need.grade);
                  const gs = new Date(ganttRange.minDate + "T00:00:00").getTime();
                  const ge = new Date(ganttRange.maxDate + "T00:00:00").getTime();
                  const span = ge - gs || 1;
                  const ns = new Date(need.startDate + "T00:00:00").getTime();
                  const ne = new Date(need.endDate + "T00:00:00").getTime();
                  const leftPct = ((ns - gs) / span) * 100;
                  const widthPct = Math.max(3, ((ne - ns) / span) * 100);
                  const wd = computeWorkingDays(need.startDate, need.endDate);
                  const isExisting = "_existing" in need;
                  const isBeingEdited = !isExisting && editingNeedId === need.id;
                  const isDimmed = hoveredGrade !== null && need.grade !== hoveredGrade;
                  const isFlashing = need.id === lastAddedId;

                  return (
                    <Tooltip
                      key={need.id}
                      placement="left"
                      arrow
                      title={`${isExisting ? "\u2713 Existing \u00b7 " : ""}${need.grade} \u00b7 ${Math.round(need.utilization ?? 100)}% \u00b7 ${need.startDate} \u2192 ${need.endDate} (${wd}d)${need.preferredPerson ? ` \u00b7 ${need.preferredPerson}` : ""}${need.skills.length ? ` \u00b7 ${need.skills.join(", ")}` : ""}${isExisting ? "\nClick to duplicate" : "\nClick to edit"}`}
                    >
                      <Box
                        sx={{
                          position: "relative",
                          height: 22,
                          mb: 0.4,
                          opacity: isDimmed ? 0.25 : 1,
                          transition: `opacity 0.2s ${easing.elegant}`,
                          "&:hover .del-btn": { opacity: 0.7 },
                        }}
                      >
                        {/* Grid lines */}
                        <Box sx={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none" }}>
                          {monthColumns.map((col, ci) => (
                            <Box
                              key={ci}
                              sx={{
                                width: `${col.widthPct}%`,
                                borderRight:
                                  ci < monthColumns.length - 1
                                    ? `1px solid ${alpha(theme.palette.divider, 0.08)}`
                                    : "none",
                              }}
                            />
                          ))}
                        </Box>
                        {/* Bar */}
                        <Box
                          onClick={() => (isExisting ? onClickExistingNeed(need) : onClickNeed(need))}
                          sx={{
                            position: "absolute",
                            top: 0,
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: "100%",
                            borderRadius: 1,
                            bgcolor: isExisting ? alpha(gc.border, 0.3) : alpha(gc.border, 0.75),
                            display: "flex",
                            alignItems: "center",
                            px: 0.75,
                            overflow: "hidden",
                            cursor: "pointer",
                            outline: isBeingEdited ? `2px solid ${gc.border}` : "none",
                            outlineOffset: 1,
                            ...(isExisting
                              ? {
                                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 3px, ${alpha(gc.border, 0.15)} 3px, ${alpha(gc.border, 0.15)} 5px)`,
                                }
                              : {}),
                            ...(isFlashing ? { ...flashAddKf, animation: "flashAdd 0.7s ease" } : {}),
                            "&:hover": { filter: "brightness(1.1)" },
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              color: isExisting ? gc.text : "#fff",
                              fontSize: "0.62rem",
                              whiteSpace: "nowrap",
                              textShadow: isExisting ? "none" : "0 1px 2px rgba(0,0,0,0.25)",
                            }}
                          >
                            {isExisting ? "\u2713 " : ""}
                            {getGradeAbbr(need.grade)} {Math.round(need.utilization ?? 100)}%
                            {need.preferredPerson ? ` \u00b7 ${need.preferredPerson.split(" ")[0]}` : ""}
                          </Typography>
                        </Box>
                        {/* Delete -- only for new needs */}
                        {!isExisting && (
                          <IconButton
                            className="del-btn"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveNeed(need.id);
                            }}
                            sx={{
                              position: "absolute",
                              right: -1,
                              top: -1,
                              width: 16,
                              height: 16,
                              opacity: 0,
                              transition: elegantT,
                              zIndex: 3,
                              "&:hover": { opacity: 1, bgcolor: "error.main", color: "#fff" },
                            }}
                          >
                            <CloseIcon sx={{ fontSize: 10 }} />
                          </IconButton>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                border: "1px dashed",
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic", fontSize: "0.75rem" }}>
                {formDatesValid ? "Click a grade to add profiles" : "Fill dates then click a grade"}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    );
  }
);

NeedsTimeline.displayName = "NeedsTimeline";

export default NeedsTimeline;
