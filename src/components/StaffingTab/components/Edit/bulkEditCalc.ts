import type { BaselineSegment, EditAction, DisplayGroup, EditableAssignment } from "./bulkEditTypes";
import { countWorkingDays } from "./bulkEditTypes";

export function buildDisplayGroups(params: {
  current: BaselineSegment[];
  baseline: BaselineSegment[];
  actionLog: EditAction[];
  redoStack: EditAction[];
  tlStartStr: string;
  tlEndStr: string;
  hpd: number;
  enabledHolidayDates: Set<string>;
  baselineUidSet: Set<string>;
  revertAllPreview: boolean;
}): DisplayGroup[] {
  const {
    current,
    baseline,
    actionLog,
    redoStack,
    tlStartStr,
    tlEndStr,
    hpd,
    enabledHolidayDates,
    baselineUidSet,
    revertAllPreview,
  } = params;

  // When revert all preview is active, show baseline state
  const source = revertAllPreview ? baseline : current;
  // Group segments by jobName::category
  const groups = new Map<string, BaselineSegment[]>();
  for (const seg of source) {
    const key = `${seg.jobName}::${seg.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(seg);
  }

  // Also detect fully-deleted baseline groups (all baseline items in group removed from current)
  const baselineByGroup = new Map<string, BaselineSegment[]>();
  for (const seg of baseline) {
    const key = `${seg.jobName}::${seg.category}`;
    if (!baselineByGroup.has(key)) baselineByGroup.set(key, []);
    baselineByGroup.get(key)!.push(seg);
  }

  // Collect groupKeys that have actions
  const actionGroupKeys = new Set(actionLog.map((a) => a.groupKey));
  // Collect groupKeys that have create actions (for NEW badge)
  const createdGroupKeys = new Set(actionLog.filter((a) => a.type === "create").map((a) => a.groupKey));

  const result: DisplayGroup[] = [];

  // Process groups that have items in current
  for (const [groupKey, items] of groups) {
    const sorted = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate));
    let totalHours = 0;
    for (const item of sorted) {
      const clippedStart = item.startDate > tlStartStr ? item.startDate : tlStartStr;
      const clippedEnd = item.endDate < tlEndStr ? item.endDate : tlEndStr;
      if (clippedStart > clippedEnd) continue;
      const wd = countWorkingDays(clippedStart, clippedEnd, enabledHolidayDates);
      totalHours += wd * (item.utilization / 100) * hpd;
    }

    // Derive flags — NEW badge only for groups that didn't exist in baseline at all
    const isEntirelyNew = createdGroupKeys.has(groupKey) && !baselineByGroup.has(groupKey);
    const hasNewItems = isEntirelyNew;
    const isModified = actionGroupKeys.has(groupKey);
    // Wrap BaselineSegment as EditableAssignment-shaped items for BulkEditRow compatibility
    const editableItems: EditableAssignment[] = sorted.map((s) => ({
      tempId: s._uid,
      originalKey: baselineUidSet.has(s._uid) ? `${s.empId}::${s.jobNo}::${s.startDate}` : null,
      _uid: s._uid,
      empId: s.empId,
      jobNo: s.jobNo,
      jobName: s.jobName,
      startDate: s.startDate,
      endDate: s.endDate,
      utilization: s.utilization,
      status: s.status,
      category: s.category,
      isDeleted: false,
      isNew: !baselineUidSet.has(s._uid),
      isModified: isModified && baselineUidSet.has(s._uid),
      original: null,
    }));

    result.push({
      groupKey,
      items: editableItems,
      jobNo: sorted[0].jobNo,
      jobName: sorted[0].jobName,
      category: sorted[0].category,
      periods: sorted.map((s) => ({
        startDate: s.startDate,
        endDate: s.endDate,
        utilization: s.utilization,
        status: s.status,
      })),
      startDate: sorted[0].startDate,
      endDate: sorted[sorted.length - 1].endDate,
      isDeleted: false,
      isModified,
      hasNewItems,
      isEntirelyNew,
      totalHours,
    });
  }

  // Ghost rows: baseline groups fully deleted (exist in baseline but not in current)
  const currentGroupKeys = new Set(groups.keys());
  for (const [groupKey, bItems] of baselineByGroup) {
    if (currentGroupKeys.has(groupKey)) continue;
    // Check if any baseline item from this group survives in current
    const anyInCurrent = bItems.some((b) => current.some((c) => c._uid === b._uid));
    if (anyInCurrent) continue;
    // This group was fully deleted — show as ghost
    const sorted = [...bItems].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const ghostItems: EditableAssignment[] = sorted.map((s) => ({
      tempId: s._uid,
      originalKey: `${s.empId}::${s.jobNo}::${s.startDate}`,
      _uid: s._uid,
      empId: s.empId,
      jobNo: s.jobNo,
      jobName: s.jobName,
      startDate: s.startDate,
      endDate: s.endDate,
      utilization: s.utilization,
      status: s.status,
      category: s.category,
      isDeleted: true,
      isNew: false,
      isModified: false,
      original: null,
    }));
    result.push({
      groupKey,
      items: ghostItems,
      jobNo: sorted[0].jobNo,
      jobName: sorted[0].jobName,
      category: sorted[0].category,
      periods: [],
      startDate: sorted[0].startDate,
      endDate: sorted[sorted.length - 1].endDate,
      isDeleted: true,
      isModified: false,
      hasNewItems: false,
      totalHours: 0,
    });
  }

  // Ghost rows for undone creations: groups with redo-able create actions not in current or baseline
  const allGroupKeys = new Set([...currentGroupKeys, ...baselineByGroup.keys()]);
  for (const action of redoStack) {
    if (action.type !== "create" || allGroupKeys.has(action.groupKey)) continue;
    allGroupKeys.add(action.groupKey); // avoid duplicates
    const seg = action.produced[0];
    if (!seg) continue;
    result.push({
      groupKey: action.groupKey,
      items: [
        {
          tempId: seg._uid,
          originalKey: null,
          _uid: seg._uid,
          empId: seg.empId,
          jobNo: seg.jobNo,
          jobName: seg.jobName,
          startDate: seg.startDate,
          endDate: seg.endDate,
          utilization: seg.utilization,
          status: seg.status,
          category: seg.category,
          isDeleted: true,
          isNew: false,
          isModified: false,
          original: null,
        },
      ],
      jobNo: seg.jobNo,
      jobName: seg.jobName,
      category: seg.category,
      periods: [],
      startDate: seg.startDate,
      endDate: seg.endDate,
      isDeleted: true,
      isModified: false,
      hasNewItems: false,
      totalHours: 0,
    });
  }

  return result;
}
