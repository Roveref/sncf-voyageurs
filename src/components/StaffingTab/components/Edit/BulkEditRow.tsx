import React, { memo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import { GANTT_LEFT_COL_WIDTH } from "../../constants";
import { PeriodBar } from "../Timeline/PeriodBar";
import { getSegmentColor } from "../../../Sidebars/segmentConstants";
import { brand } from "../../../../config/brandConfig";
import { getBarColor } from "./bulkEditTypes";
import type { DisplayGroup, LabelParts } from "./bulkEditTypes";

const LEFT_COL = GANTT_LEFT_COL_WIDTH;

// ── BulkEditRow ──

export interface BulkEditRowProps {
  group: DisplayGroup;
  labelParts: LabelParts;
  tl: {
    start: string;
    totalDays: number;
    numCols: number;
    dayToCol: (d: string) => number;
    weekendSet: Set<number>;
    mondayCols: number[];
  };
  isSelected: boolean;
  hasSelection: boolean;
  selectionSubRange?: { start: string; end: string };
  onSelect: (groupKey: string) => void;
  onDragSelect?: (groupKey: string, range: { start: string; end: string }) => void;
  onNameClick?: () => void;
  leftColShrink: number;
  segment?: string;
  ioBadge?: boolean;
  rowIndex?: number;
  onRevert?: () => void;
  /** Gap fill preview */
  gapFillPreviewPeriods?: { startDate: string; endDate: string; utilization: number; status: string }[];
  /** Edit action preview (replaces group.periods when set) */
  editPreviewPeriods?: { startDate: string; endDate: string; utilization: number; status: string }[] | null;
}

export const BulkEditRow = memo(
  ({
    group,
    labelParts,
    tl,
    isSelected,
    hasSelection,
    selectionSubRange,
    onSelect,
    onDragSelect,
    onNameClick,
    onRevert,
    leftColShrink,
    segment,
    ioBadge,
    rowIndex: _rowIndex = 0,
    gapFillPreviewPeriods,
    editPreviewPeriods,
  }: BulkEditRowProps) => {
    const effectiveLeft = LEFT_COL - leftColShrink;
    const color = getBarColor(group.category);

    const handleClick = useCallback(() => {
      onSelect(group.groupKey);
    }, [onSelect, group.groupKey]);

    const handleDragSelect = useCallback(
      (dateRange: { start: string; end: string }) => {
        onDragSelect?.(group.groupKey, dateRange);
      },
      [onDragSelect, group.groupKey]
    );

    return (
      <Box
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          opacity: group.isDeleted && !editPreviewPeriods ? 0.35 : hasSelection && !isSelected ? 0.4 : 1,
          bgcolor:
            group.isDeleted && !editPreviewPeriods
              ? "rgba(204,41,49,0.06)"
              : editPreviewPeriods
                ? "rgba(16,185,129,0.06)"
                : group.hasNewItems
                  ? "rgba(16,185,129,0.04)"
                  : isSelected
                    ? "rgba(204,193,188,0.18)"
                    : group.isModified
                      ? "rgba(204,193,188,0.04)"
                      : "transparent",
          textDecoration: group.isDeleted && !editPreviewPeriods ? "line-through" : "none",
          transition: "opacity 0.15s, background-color 0.15s",
          "&:hover": {
            bgcolor:
              group.isDeleted && !editPreviewPeriods
                ? "rgba(204,41,49,0.1)"
                : isSelected
                  ? "rgba(204,193,188,0.22)"
                  : "rgba(249,250,251,0.5)",
          },
          borderLeft:
            group.isDeleted && !editPreviewPeriods
              ? "3px solid #CCC1BC"
              : group.hasNewItems
                ? "3px solid #10b981"
                : group.isModified
                  ? "3px solid rgba(204,193,188,0.5)"
                  : "3px solid transparent",
        }}
      >
        {/* Left col -- read-only label */}
        <Box
          sx={{
            flexShrink: 0,
            px: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
          }}
          style={{ width: effectiveLeft - 3 }}
        >
          {/* -3 for borderLeft */}
          <Box
            sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, ml: 1.5, position: "relative" }}
            style={{ backgroundColor: color }}
          >
            {(group.isModified || onRevert) && !group.isDeleted && (
              <EditIcon
                sx={{
                  fontSize: 10,
                  color: brand.secondaryLightest,
                  position: "absolute",
                  right: "calc(100% + 3px)",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
            )}
          </Box>
          {group.hasNewItems && !group.isDeleted && (
            <Box
              sx={{
                fontSize: "0.5rem",
                fontWeight: 700,
                color: "#059669",
                bgcolor: "#ecfdf5",
                px: 0.5,
                borderRadius: 0.5,
                lineHeight: 1.4,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              NEW
            </Box>
          )}
          {labelParts.account ? (
            <Box
              component="span"
              onClick={
                onNameClick
                  ? (e) => {
                      e.stopPropagation();
                      onNameClick();
                    }
                  : undefined
              }
              sx={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                minWidth: 0,
                gap: 0.25,
                cursor: onNameClick ? "pointer" : undefined,
                overflow: "hidden",
                "&:hover": {
                  overflow: "visible",
                  zIndex: 5,
                  "& .MuiTypography-root": {
                    overflow: "visible",
                    textOverflow: "clip",
                    flex: "none",
                    bgcolor: "rgba(249,250,251,0.95)",
                  },
                  "& .account-sep": { display: "inline" },
                  "& .MuiTypography-root:last-of-type": {
                    pr: 6,
                    maskImage: "linear-gradient(to right, black calc(100% - 48px), transparent)",
                    WebkitMaskImage: "linear-gradient(to right, black calc(100% - 48px), transparent)",
                  },
                },
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontSize: "0.875rem",
                  color: "text.primary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {labelParts.account}
              </Typography>
              <Typography
                component="span"
                className="account-sep"
                sx={{ fontSize: "0.875rem", color: "text.disabled", flexShrink: 0, display: "none" }}
              >
                &nbsp;-&nbsp;
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontSize: "0.875rem",
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {labelParts.oppName}
              </Typography>
            </Box>
          ) : (
            <Typography
              component="span"
              onClick={
                onNameClick
                  ? (e) => {
                      e.stopPropagation();
                      onNameClick();
                    }
                  : undefined
              }
              sx={{
                fontSize: "0.875rem",
                color: "text.primary",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
                cursor: onNameClick ? "pointer" : undefined,
              }}
            >
              {labelParts.name}
            </Typography>
          )}
          <Typography
            component="span"
            sx={{ fontSize: "0.75rem", color: "text.secondary", flexShrink: 0, width: 60, textAlign: "right" }}
          >
            {labelParts.jobNo}
          </Typography>
          <Typography
            component="span"
            sx={{ fontSize: "0.75rem", color: "text.secondary", flexShrink: 0, width: 40, textAlign: "right" }}
          >
            {labelParts.hours}
          </Typography>
          <Typography
            component="span"
            sx={{ fontSize: "0.75rem", color: "text.disabled", flexShrink: 0, width: 32, textAlign: "right" }}
          >
            {labelParts.days}
          </Typography>
          <Box
            component="span"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              flexShrink: 0,
              width: 64,
              justifyContent: "flex-end",
            }}
          >
            {ioBadge && (
              <Box
                component="span"
                sx={{
                  fontSize: "0.625rem",
                  px: 0.5,
                  py: 0,
                  borderRadius: 0.5,
                  bgcolor: "#ede9fe",
                  color: "#7c3aed",
                  flexShrink: 0,
                  lineHeight: 1.5,
                }}
              >
                I&O
              </Box>
            )}
            {segment && (
              <Box
                component="span"
                sx={{
                  fontSize: "0.625rem",
                  px: 0.5,
                  py: 0,
                  borderRadius: 0.5,
                  bgcolor: getSegmentColor(segment),
                  color: "#fff",
                  flexShrink: 0,
                  lineHeight: 1.5,
                }}
              >
                {segment}
              </Box>
            )}
          </Box>
        </Box>

        {/* Right col -- PeriodBar with drag-select */}
        <Box sx={{ flex: 1, pr: 1.5, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
          {(group.periods.length > 0 ||
            (gapFillPreviewPeriods && gapFillPreviewPeriods.length > 0) ||
            (editPreviewPeriods && editPreviewPeriods.length > 0)) && (
            <PeriodBar
              periods={
                editPreviewPeriods
                  ? editPreviewPeriods
                  : gapFillPreviewPeriods
                    ? [...group.periods, ...gapFillPreviewPeriods]
                    : group.periods
              }
              color={color}
              tlStart={tl.start}
              totalDays={tl.totalDays}
              numCols={tl.numCols}
              dayToCol={tl.dayToCol}
              weekendSet={tl.weekendSet}
              mondayCols={tl.mondayCols}
              jobName={group.jobName || group.jobNo || "Assignment"}
              onDragSelect={handleDragSelect}
              persistedSelection={isSelected && selectionSubRange ? selectionSubRange : undefined}
            />
          )}
        </Box>
      </Box>
    );
  }
);
BulkEditRow.displayName = "BulkEditRow";
