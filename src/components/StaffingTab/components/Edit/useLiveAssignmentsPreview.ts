import { useEffect } from "react";
import { HOURS_PER_DAY, JOB_CATEGORIES } from "../../constants";
import { toDateString } from "../../utils/dateUtils";
import type { BaselineSegment, EditAction, DisplayGroup, CreateMode } from "./bulkEditTypes";

export function useLiveAssignmentsPreview(params: {
  current: BaselineSegment[];
  baseline: BaselineSegment[];
  actionLog: EditAction[];
  onLiveAssignmentsChange: ((assignments: any[] | null) => void) | undefined;
  revertAllPreview: boolean;
  createMode: CreateMode;
  createUtilization: number;
  createSegments: { startDate: string; endDate: string; utilization: number }[] | null;
  createExistingOverrides:
    | {
        origJobNo: string;
        origStartDate: string;
        replacements: { startDate: string; endDate: string; utilization: number }[];
      }[]
    | null;
  previewPeriods: { startDate: string; endDate: string; utilization: number; status: string }[] | null;
  selectedGroup: DisplayGroup | undefined;
  revertPreviewGroupKey: string | null;
  revertPreviewPeriods: { startDate: string; endDate: string; utilization: number; status: string }[] | null;
  displayGroups: DisplayGroup[];
  globalBarOpen: boolean;
}): void {
  const {
    current,
    baseline,
    actionLog,
    onLiveAssignmentsChange,
    revertAllPreview,
    createMode,
    createUtilization,
    createSegments,
    createExistingOverrides,
    previewPeriods,
    selectedGroup,
    revertPreviewGroupKey,
    revertPreviewPeriods,
    displayGroups,
    globalBarOpen,
  } = params;

  // Notify parent of live assignments for UtilizationChart
  useEffect(() => {
    if (!onLiveAssignmentsChange) return;

    // Revert All preview: show baseline assignments only
    if (revertAllPreview) {
      const baselineLive = baseline.map((item) => ({
        jobNo: item.jobNo,
        jobName: item.jobName,
        startDate: item.startDate,
        endDate: item.endDate,
        utilization: item.utilization,
        status: item.status,
        category: item.category,
        hoursPerDay: HOURS_PER_DAY,
      }));
      onLiveAssignmentsChange(baselineLive);
      return;
    }

    let live: {
      jobNo: string;
      jobName: string;
      startDate: string;
      endDate: string;
      utilization: number;
      status: string;
      category: string;
      hoursPerDay: number;
      _isNewCreation?: boolean;
    }[] = current.map((item) => ({
      jobNo: item.jobNo,
      jobName: item.jobName,
      startDate: item.startDate,
      endDate: item.endDate,
      utilization: item.utilization,
      status: item.status,
      category: item.category,
      hoursPerDay: HOURS_PER_DAY,
    }));

    // Apply pending action preview: replace selected group's items with simulated preview
    if (previewPeriods && selectedGroup) {
      const origItems = selectedGroup.items.filter((i) => !i.isDeleted);
      const origKeys = new Set(origItems.map((i) => `${i.jobNo}::${i.startDate}::${i.endDate}`));
      live = live.filter((a) => !origKeys.has(`${a.jobNo}::${a.startDate}::${a.endDate}`));
      for (const p of previewPeriods) {
        live.push({
          jobNo: selectedGroup.jobNo,
          jobName: selectedGroup.jobName || "",
          startDate: p.startDate,
          endDate: p.endDate,
          utilization: p.utilization,
          status: p.status,
          category: selectedGroup.category,
          hoursPerDay: HOURS_PER_DAY,
        });
      }
    }

    // Apply existing assignment overrides (replace/fit_in) for live preview
    if (createExistingOverrides && createExistingOverrides.length > 0) {
      const overrideMap = new Map<string, { startDate: string; endDate: string; utilization: number }[]>();
      for (const ov of createExistingOverrides) {
        const key = `${ov.origJobNo}::${ov.origStartDate}`;
        overrideMap.set(key, ov.replacements);
      }
      const newLive: typeof live = [];
      for (const a of live) {
        const key = `${a.jobNo}::${a.startDate}`;
        const replacements = overrideMap.get(key);
        if (replacements !== undefined) {
          for (const r of replacements)
            newLive.push({ ...a, startDate: r.startDate, endDate: r.endDate, utilization: r.utilization });
        } else {
          newLive.push(a);
        }
      }
      live = newLive;
    }

    // Include in-progress creation assignment for live preview (unified add + gap fill)
    if (createMode?.range && createUtilization > 0) {
      const cJobNo = createMode.jobNo || "";
      const cJobName = createMode.jobName || "";
      const cCategory = createMode.category || JOB_CATEGORIES.CHARGEABLE;
      if (createSegments && createSegments.length > 0) {
        for (const seg of createSegments) {
          live.push({
            jobNo: cJobNo,
            jobName: cJobName,
            startDate: seg.startDate,
            endDate: seg.endDate,
            utilization: seg.utilization,
            status: "C",
            category: cCategory,
            hoursPerDay: HOURS_PER_DAY,
            _isNewCreation: true,
          });
        }
      } else {
        live.push({
          jobNo: cJobNo,
          jobName: cJobName,
          startDate: createMode.range.start,
          endDate: createMode.range.end,
          utilization: createUtilization,
          status: "C",
          category: cCategory,
          hoursPerDay: HOURS_PER_DAY,
          _isNewCreation: true,
        });
      }
    }

    // When revert preview is active, replace the group's items with the baseline periods
    if (revertPreviewGroupKey && revertPreviewPeriods) {
      const revertGroup = displayGroups.find((g) => g.groupKey === revertPreviewGroupKey);
      if (revertGroup) {
        live = live.filter((a) => !(a.jobNo === revertGroup.jobNo && a.category === revertGroup.category));
      }
      const baseItems = baseline.filter((s) => `${s.jobName}::${s.category}` === revertPreviewGroupKey);
      const sample = baseItems[0];
      for (const p of revertPreviewPeriods) {
        live.push({
          jobNo: sample?.jobNo || "",
          jobName: sample?.jobName || "",
          startDate: p.startDate,
          endDate: p.endDate,
          utilization: p.utilization,
          status: p.status,
          category: sample?.category || "chargeable",
          hoursPerDay: HOURS_PER_DAY,
        });
      }
    }

    const hasActiveSimulation = !!createMode || !!previewPeriods || !!revertPreviewGroupKey;
    const hasStateChanges = actionLog.length > 0;
    if (hasActiveSimulation || hasStateChanges || globalBarOpen) {
      onLiveAssignmentsChange(live);
    } else {
      onLiveAssignmentsChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    current,
    baseline,
    actionLog,
    onLiveAssignmentsChange,
    revertAllPreview,
    createMode,
    createUtilization,
    createSegments,
    createExistingOverrides,
    previewPeriods,
    selectedGroup,
    revertPreviewGroupKey,
    revertPreviewPeriods,
    displayGroups,
  ]);
}
