import React, { memo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { HOURS_PER_DAY, CHARGEABLE_CATS, GO_CATS } from "../../constants";
import { BulkEditRow } from "./BulkEditRow";
import { countWorkingDays } from "./bulkEditTypes";
import type { BulkSelection, DisplayGroup, LabelParts, CreateMode } from "./bulkEditTypes";

interface CategorySection {
  title: string;
  key: string;
  dotColor: string;
  groups: DisplayGroup[];
}

interface BulkEditCategorySectionsProps {
  categorySections: CategorySection[];
  tl: any;
  effectiveLeft: number;
  validSelection: BulkSelection | null;
  createMode: CreateMode;
  createUtilization: number;
  createSegments: { startDate: string; endDate: string; utilization: number }[] | null;
  revertPreviewGroupKey: string | null;
  revertPreviewPeriods: { startDate: string; endDate: string; utilization: number; status: string }[] | null;
  previewPeriods: { startDate: string; endDate: string; utilization: number; status: string }[] | null;
  revertableGroups: Set<string>;
  handleRowSelect: (groupKey: string) => void;
  handleRowDragSelect?: (groupKey: string, range: { start: string; end: string }) => void;
  handleRevertClick: (groupKey: string) => void;
  onNavigateToOpportunity: (jobNo: string) => void;
  getLabelParts: (group: DisplayGroup) => LabelParts;
  leftColShrink: number;
  pipelineJobcodes: Map<string, any> | null;
  showIO: string;
  ioJobcodes: Set<string> | null | undefined;
  readOnly: boolean;
  hpd: number;
  tlStartStr: string;
  tlEndStr: string;
  enabledHolidayDates: Set<string>;
}

const BulkEditCategorySections = memo(
  ({
    categorySections,
    tl,
    effectiveLeft,
    validSelection,
    createMode,
    createUtilization,
    createSegments,
    revertPreviewGroupKey,
    revertPreviewPeriods,
    previewPeriods,
    revertableGroups,
    handleRowSelect,
    handleRowDragSelect,
    handleRevertClick,
    onNavigateToOpportunity,
    getLabelParts,
    leftColShrink,
    pipelineJobcodes,
    showIO,
    ioJobcodes,
    readOnly,
    hpd,
    tlStartStr,
    tlEndStr,
    enabledHolidayDates,
  }: BulkEditCategorySectionsProps) => {
    return (
      <>
        {categorySections.map((section, sIdx) => (
          <React.Fragment key={section.key}>
            {/* Category sub-section label */}
            {(() => {
              const secH = section.groups.reduce((sum, g) => sum + g.totalHours, 0);
              const secD = Math.round((secH / HOURS_PER_DAY) * 10) / 10;
              const hStr = secH % 1 === 0 ? `${secH}` : `${secH.toFixed(1)}`;
              const dStr = secD % 1 === 0 ? `${secD}` : `${secD.toFixed(1)}`;
              return (
                <>
                  <Box sx={{ borderTop: "0.5px solid", borderColor: "divider", ml: "10px" }} />
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      pt: 0.5,
                      pb: 0.25,
                      borderLeft: "3px solid transparent",
                    }}
                  >
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
                      <Typography
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.disabled",
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {section.title}
                      </Typography>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.disabled",
                          flexShrink: 0,
                          width: 60,
                          textAlign: "right",
                        }}
                      />
                      <Typography
                        component="span"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.disabled",
                          flexShrink: 0,
                          width: 40,
                          textAlign: "right",
                        }}
                      >
                        {hStr}
                      </Typography>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.disabled",
                          flexShrink: 0,
                          width: 32,
                          textAlign: "right",
                        }}
                      >
                        {dStr}
                      </Typography>
                      <Box component="span" sx={{ flexShrink: 0, width: 64 }} />
                    </Box>
                  </Box>
                </>
              );
            })()}
            {section.groups.map((group, gIdx) => {
              const isGapFillRow = createMode?.type === "gap_fill" && createMode.groupKey === group.groupKey;
              const gapPreview =
                isGapFillRow && createMode?.range
                  ? createSegments && createSegments.length > 0
                    ? createSegments.map((s) => ({
                        startDate: s.startDate,
                        endDate: s.endDate,
                        utilization: s.utilization,
                        status: "P",
                      }))
                    : createUtilization > 0
                      ? [
                          {
                            startDate: createMode.range.start,
                            endDate: createMode.range.end,
                            utilization: createUtilization,
                            status: "P",
                          },
                        ]
                      : undefined
                  : undefined;
              const isRevertPreview = revertPreviewGroupKey === group.groupKey && revertPreviewPeriods;
              const effectiveLabelParts = isRevertPreview
                ? (() => {
                    let totalH = 0;
                    for (const p of revertPreviewPeriods!) {
                      const clippedStart = p.startDate > tlStartStr ? p.startDate : tlStartStr;
                      const clippedEnd = p.endDate < tlEndStr ? p.endDate : tlEndStr;
                      if (clippedStart > clippedEnd) continue;
                      totalH +=
                        countWorkingDays(clippedStart, clippedEnd, enabledHolidayDates) *
                        ((p.utilization ?? 100) / 100) *
                        hpd;
                    }
                    const totalDays = Math.round((totalH / hpd) * 10) / 10;
                    const base = getLabelParts(group);
                    return {
                      ...base,
                      hours: totalH % 1 === 0 ? `${totalH}` : `${totalH.toFixed(1)}`,
                      days: totalDays % 1 === 0 ? `${totalDays}` : `${totalDays.toFixed(1)}`,
                    };
                  })()
                : getLabelParts(group);
              return (
                <BulkEditRow
                  key={group.groupKey}
                  group={group}
                  labelParts={effectiveLabelParts}
                  tl={tl}
                  isSelected={validSelection?.groupKey === group.groupKey || isGapFillRow}
                  hasSelection={!!validSelection}
                  selectionSubRange={
                    validSelection?.groupKey === group.groupKey
                      ? validSelection?.subRange
                      : isGapFillRow && createMode?.range
                        ? createMode.range
                        : undefined
                  }
                  onSelect={handleRowSelect}
                  onDragSelect={handleRowDragSelect}
                  onNameClick={() => onNavigateToOpportunity(group.jobNo)}
                  onRevert={
                    !readOnly && revertableGroups.has(group.groupKey)
                      ? () => handleRevertClick(group.groupKey)
                      : undefined
                  }
                  leftColShrink={leftColShrink}
                  segment={
                    CHARGEABLE_CATS.has(group.category) || GO_CATS.has(group.category)
                      ? pipelineJobcodes?.get(group.jobNo)?.segment
                      : undefined
                  }
                  ioBadge={showIO !== "off" && ioJobcodes?.has(String(group.jobNo).trim())}
                  rowIndex={gIdx}
                  gapFillPreviewPeriods={gapPreview}
                  editPreviewPeriods={
                    revertPreviewGroupKey === group.groupKey
                      ? revertPreviewPeriods
                      : validSelection?.groupKey === group.groupKey
                        ? previewPeriods
                        : null
                  }
                />
              );
            })}
          </React.Fragment>
        ))}
      </>
    );
  }
);
BulkEditCategorySections.displayName = "BulkEditCategorySections";

export { BulkEditCategorySections };
export type { CategorySection };
