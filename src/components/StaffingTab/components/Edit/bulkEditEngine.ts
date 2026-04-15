import { toDateString } from "../../utils/dateUtils";
import { countWorkingDays } from "./bulkEditTypes";
import type {
  BaselineSegment,
  EditableAssignment,
  EditAction,
  EditorState,
  EditorReducerAction,
  BulkEditOperation,
} from "./bulkEditTypes";

// ── Helpers ──

function findLastIndex<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

/** Advance date by N calendar days */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

/** Find the Nth working day from start, return its date string */
export function nthWorkingDay(start: string, n: number, holidays?: Set<string>): string {
  let count = 0;
  const cursor = new Date(start);
  const limit = 5000;
  for (let i = 0; i < limit; i++) {
    const dow = cursor.getDay();
    const ds = toDateString(cursor);
    if (dow !== 0 && dow !== 6 && !(holidays && holidays.has(ds))) {
      count++;
      if (count === n) return toDateString(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return start;
}

function uid(): string {
  return crypto.randomUUID();
}

function groupKeyOf(seg: BaselineSegment): string {
  return `${seg.jobName}::${seg.category}`;
}

/** Simulate an edit action for preview — produces visual result without mutating state */
export function simulateEditAction(
  items: (EditableAssignment | BaselineSegment)[],
  action: "truncate" | "reduce_util" | "reduce_days",
  start: string,
  end: string,
  hasSubRange: boolean,
  params: { reduceUtil?: number; reduceDays?: number; holidays?: Set<string> }
): { startDate: string; endDate: string; utilization: number; status: string }[] {
  let simItems = items.filter((i) => !("isDeleted" in i && i.isDeleted));
  if (action === "truncate") {
    if (hasSubRange) {
      simItems = simItems.flatMap((item) => {
        if (item.startDate > end || item.endDate < start) return [item];
        if (start <= item.startDate && end >= item.endDate) return [];
        if (start <= item.startDate) return [{ ...item, startDate: addDays(end, 1) }];
        if (end >= item.endDate) return [{ ...item, endDate: addDays(start, -1) }];
        return [
          { ...item, endDate: addDays(start, -1) },
          { ...item, startDate: addDays(end, 1) },
        ];
      });
    } else {
      simItems = [];
    }
  } else if (action === "reduce_util") {
    const rUtil = params.reduceUtil ?? 50;
    simItems = simItems.flatMap((item) => {
      const os = item.startDate > start ? item.startDate : start;
      const oe = item.endDate < end ? item.endDate : end;
      if (os > oe) return [item];
      if (os <= item.startDate && oe >= item.endDate) return [{ ...item, utilization: rUtil }];
      const frags: typeof simItems = [];
      if (os > item.startDate) frags.push({ ...item, endDate: addDays(os, -1) });
      frags.push({ ...item, startDate: os, endDate: oe, utilization: rUtil });
      if (oe < item.endDate) frags.push({ ...item, startDate: addDays(oe, 1) });
      return frags;
    });
  } else if (action === "reduce_days") {
    const rDays = params.reduceDays ?? 5;
    simItems = simItems.flatMap((item) => {
      const os = item.startDate > start ? item.startDate : start;
      const oe = item.endDate < end ? item.endDate : end;
      if (os > oe) return [item];
      const totalWd = countWorkingDays(os, oe, params.holidays);
      if (rDays >= totalWd) return [item];
      const cutDate = nthWorkingDay(os, rDays, params.holidays);
      const frags: typeof simItems = [];
      if (os > item.startDate) frags.push({ ...item, endDate: addDays(os, -1) });
      frags.push({ ...item, startDate: os, endDate: cutDate });
      if (item.endDate > oe) frags.push({ ...item, startDate: addDays(oe, 1) });
      return frags;
    });
  }
  return simItems.map((i) => ({
    startDate: i.startDate,
    endDate: i.endDate,
    utilization: i.utilization,
    status: i.status || "C",
  }));
}

// ── Core: replay & diff ──

/** Replay action log on top of baseline to produce current state */
export function replayActions(baseline: BaselineSegment[], actionLog: EditAction[]): BaselineSegment[] {
  const segments = new Map<string, BaselineSegment>();
  for (const s of baseline) segments.set(s._uid, s);
  for (const action of actionLog) {
    for (const u of action.sourceUids) segments.delete(u);
    for (const seg of action.produced) segments.set(seg._uid, seg);
  }
  return Array.from(segments.values());
}

/** Diff baseline vs current to produce BulkEditOperation[] for the parent save API */
export function computeOps(baseline: BaselineSegment[], current: BaselineSegment[]): BulkEditOperation[] {
  const baseMap = new Map<string, BaselineSegment>();
  for (const s of baseline) baseMap.set(s._uid, s);
  const curMap = new Map<string, BaselineSegment>();
  for (const s of current) curMap.set(s._uid, s);

  const ops: BulkEditOperation[] = [];

  // Deleted: in baseline, not in current
  for (const [bUid, b] of baseMap) {
    if (!curMap.has(bUid)) {
      const origKey = `${b.empId}::${b.jobNo}::${b.startDate}`;
      ops.push({
        type: "delete",
        data: { _uid: b._uid, empId: b.empId, jobNo: b.jobNo, startDate: b.startDate, endDate: b.endDate },
        originalKey: origKey,
      });
    }
  }

  // Created: in current, not in baseline
  for (const [cUid, c] of curMap) {
    if (!baseMap.has(cUid)) {
      ops.push({
        type: "create",
        data: {
          _uid: c._uid,
          empId: c.empId,
          jobNo: c.jobNo,
          jobName: c.jobName,
          startDate: c.startDate,
          endDate: c.endDate,
          utilization: c.utilization,
          status: c.status,
          category: c.category,
        },
      });
    }
  }

  // Edited: in both but changed
  for (const [cUid, c] of curMap) {
    const b = baseMap.get(cUid);
    if (!b) continue;
    if (
      b.startDate !== c.startDate ||
      b.endDate !== c.endDate ||
      b.utilization !== c.utilization ||
      b.status !== c.status ||
      b.category !== c.category ||
      b.jobNo !== c.jobNo ||
      b.jobName !== c.jobName
    ) {
      const origKey = `${b.empId}::${b.jobNo}::${b.startDate}`;
      ops.push({
        type: "edit",
        data: {
          _uid: c._uid,
          empId: c.empId,
          jobNo: c.jobNo,
          jobName: c.jobName,
          startDate: c.startDate,
          endDate: c.endDate,
          utilization: c.utilization,
          status: c.status,
          category: c.category,
        },
        originalKey: origKey,
        ...(b.startDate !== c.startDate ? { originalStartDate: b.startDate } : {}),
      });
    }
  }

  // Deduplicate deletes for items that were split (same originalKey)
  const seen = new Set<string>();
  return ops.filter((op) => {
    if (op.type === "delete" && op.originalKey) {
      if (seen.has(op.originalKey)) return false;
      seen.add(op.originalKey);
    }
    return true;
  });
}

// ── Convert raw assignment to BaselineSegment ──

export function toBaselineSegment(a: any, empId: string): BaselineSegment {
  const sd = typeof a.startDate === "string" ? a.startDate : toDateString(a.startDate);
  const ed = typeof a.endDate === "string" ? a.endDate : toDateString(a.endDate);
  return {
    _uid: a._uid || uid(),
    empId,
    jobNo: a.jobNo || "",
    jobName: a.jobName || "",
    startDate: sd,
    endDate: ed,
    utilization: a.utilization ?? 100,
    status: a.status || "C",
    category: a.category || "chargeable",
  };
}

// ── Action Builders ──

export function buildCreateAction(
  empId: string,
  data: {
    jobNo: string;
    jobName: string;
    startDate: string;
    endDate: string;
    utilization: number;
    status: string;
    category: string;
    needId?: string;
    source?: BaselineSegment["source"];
  }
): EditAction {
  const gk = `${data.jobName}::${data.category}`;
  const seg: BaselineSegment = {
    _uid: uid(),
    empId,
    jobNo: data.jobNo,
    jobName: data.jobName,
    startDate: data.startDate,
    endDate: data.endDate,
    utilization: data.utilization,
    status: data.status,
    category: data.category,
    ...(data.needId && { needId: data.needId }),
    ...(data.source && { source: data.source }),
  };
  return { actionId: uid(), groupKey: gk, type: "create", sourceUids: [], produced: [seg] };
}

export function buildDeleteAction(source: BaselineSegment): EditAction {
  return {
    actionId: uid(),
    groupKey: groupKeyOf(source),
    type: "delete",
    sourceUids: [source._uid],
    produced: [],
  };
}

export function buildSplitDeleteAction(source: BaselineSegment, start: string, end: string): EditAction {
  const gk = groupKeyOf(source);
  // Full coverage
  if (start <= source.startDate && end >= source.endDate) {
    return { actionId: uid(), groupKey: gk, type: "split_delete", sourceUids: [source._uid], produced: [] };
  }
  const produced: BaselineSegment[] = [];
  // Touches start only
  if (start <= source.startDate && end < source.endDate) {
    produced.push({ ...source, _uid: uid(), startDate: addDays(end, 1) });
  }
  // Touches end only
  else if (start > source.startDate && end >= source.endDate) {
    produced.push({ ...source, _uid: uid(), endDate: addDays(start, -1) });
  }
  // Middle → split into 2 fragments
  else {
    produced.push({ ...source, _uid: uid(), endDate: addDays(start, -1) });
    produced.push({ ...source, _uid: uid(), startDate: addDays(end, 1) });
  }
  return { actionId: uid(), groupKey: gk, type: "split_delete", sourceUids: [source._uid], produced };
}

export function buildReduceUtilAction(
  source: BaselineSegment,
  start: string,
  end: string,
  newUtil: number
): EditAction {
  const gk = groupKeyOf(source);
  const overlapStart = source.startDate > start ? source.startDate : start;
  const overlapEnd = source.endDate < end ? source.endDate : end;
  if (overlapStart > overlapEnd) {
    return { actionId: uid(), groupKey: gk, type: "reduce_util", sourceUids: [], produced: [] };
  }
  // Full coverage
  if (overlapStart <= source.startDate && overlapEnd >= source.endDate) {
    return {
      actionId: uid(),
      groupKey: gk,
      type: "reduce_util",
      sourceUids: [source._uid],
      produced: [{ ...source, _uid: uid(), utilization: newUtil }],
    };
  }
  const produced: BaselineSegment[] = [];
  if (overlapStart > source.startDate) {
    produced.push({ ...source, _uid: uid(), endDate: addDays(overlapStart, -1) });
  }
  produced.push({ ...source, _uid: uid(), startDate: overlapStart, endDate: overlapEnd, utilization: newUtil });
  if (overlapEnd < source.endDate) {
    produced.push({ ...source, _uid: uid(), startDate: addDays(overlapEnd, 1) });
  }
  return { actionId: uid(), groupKey: gk, type: "reduce_util", sourceUids: [source._uid], produced };
}

export function buildReduceDaysAction(
  source: BaselineSegment,
  start: string,
  end: string,
  keepDays: number,
  holidays?: Set<string>
): EditAction {
  const gk = groupKeyOf(source);
  const overlapStart = source.startDate > start ? source.startDate : start;
  const overlapEnd = source.endDate < end ? source.endDate : end;
  if (overlapStart > overlapEnd) {
    return { actionId: uid(), groupKey: gk, type: "reduce_days", sourceUids: [], produced: [] };
  }
  const totalWd = countWorkingDays(overlapStart, overlapEnd, holidays);
  if (keepDays >= totalWd) {
    return { actionId: uid(), groupKey: gk, type: "reduce_days", sourceUids: [], produced: [] };
  }
  const keepEnd = nthWorkingDay(overlapStart, keepDays, holidays);
  const produced: BaselineSegment[] = [];
  if (overlapStart > source.startDate) {
    produced.push({ ...source, _uid: uid(), endDate: addDays(overlapStart, -1) });
  }
  produced.push({ ...source, _uid: uid(), startDate: overlapStart, endDate: keepEnd });
  if (overlapEnd < source.endDate) {
    produced.push({ ...source, _uid: uid(), startDate: addDays(overlapEnd, 1) });
  }
  return { actionId: uid(), groupKey: gk, type: "reduce_days", sourceUids: [source._uid], produced };
}

export function buildReduceUtilMultiAction(
  source: BaselineSegment,
  zones: { start: string; end: string; newUtil: number }[]
): EditAction {
  const gk = groupKeyOf(source);
  const sorted = [...zones].sort((a, b) => (a.start < b.start ? -1 : 1));
  const produced: BaselineSegment[] = [];
  let cursor = source.startDate;
  for (const z of sorted) {
    if (z.start > source.endDate || z.end < source.startDate) continue;
    const zStart = z.start > source.startDate ? z.start : source.startDate;
    const zEnd = z.end < source.endDate ? z.end : source.endDate;
    // Gap before this zone: keep original util
    if (cursor < zStart) {
      produced.push({ ...source, _uid: uid(), startDate: cursor, endDate: addDays(zStart, -1) });
    }
    // Zone: reduced util
    if (z.newUtil > 0) {
      produced.push({ ...source, _uid: uid(), startDate: zStart, endDate: zEnd, utilization: z.newUtil });
    }
    // If newUtil <= 0, we effectively delete this zone (don't produce a segment)
    cursor = addDays(zEnd, 1);
  }
  // Remainder after last zone
  if (cursor <= source.endDate) {
    produced.push({ ...source, _uid: uid(), startDate: cursor, endDate: source.endDate });
  }
  // If no zones actually applied, return no-op
  if (
    produced.length === 1 &&
    produced[0].startDate === source.startDate &&
    produced[0].endDate === source.endDate &&
    produced[0].utilization === source.utilization
  ) {
    return { actionId: uid(), groupKey: gk, type: "reduce_util_multi", sourceUids: [], produced: [] };
  }
  return { actionId: uid(), groupKey: gk, type: "reduce_util_multi", sourceUids: [source._uid], produced };
}

export function buildUpdateFieldAction(source: BaselineSegment, field: string, value: any): EditAction {
  const updated = { ...source, _uid: uid(), [field]: value };
  return {
    actionId: uid(),
    groupKey: groupKeyOf(source),
    type: "update_field",
    sourceUids: [source._uid],
    produced: [updated],
  };
}

// ── Editor Reducer ──

function initState(assignments: any[], empId: string): EditorState {
  const baseline = assignments.map((a) => toBaselineSegment(a, empId));
  return { baseline, actionLog: [], redoStack: [], current: [...baseline] };
}

export function editorReducer(state: EditorState, action: EditorReducerAction): EditorState {
  switch (action.type) {
    case "INIT": {
      return initState(action.assignments, action.empId);
    }
    case "APPLY": {
      const newLog = [...state.actionLog, action.action];
      return { ...state, actionLog: newLog, redoStack: [], current: replayActions(state.baseline, newLog) };
    }
    case "APPLY_BATCH": {
      const newLog = [...state.actionLog, ...action.actions];
      return { ...state, actionLog: newLog, redoStack: [], current: replayActions(state.baseline, newLog) };
    }
    case "UNDO": {
      if (state.actionLog.length === 0) return state;
      const undone = state.actionLog[state.actionLog.length - 1];
      const newLog = state.actionLog.slice(0, -1);
      return {
        ...state,
        actionLog: newLog,
        redoStack: [...state.redoStack, undone],
        current: replayActions(state.baseline, newLog),
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const redone = state.redoStack[state.redoStack.length - 1];
      const newLog = [...state.actionLog, redone];
      return {
        ...state,
        actionLog: newLog,
        redoStack: state.redoStack.slice(0, -1),
        current: replayActions(state.baseline, newLog),
      };
    }
    case "UNDO_GROUP": {
      // Find last action for this groupKey and move it to redoStack
      const idx = findLastIndex(state.actionLog, (a) => a.groupKey === action.groupKey);
      if (idx === -1) return state;
      const undone = state.actionLog[idx];
      const newLog = [...state.actionLog.slice(0, idx), ...state.actionLog.slice(idx + 1)];
      return {
        ...state,
        actionLog: newLog,
        redoStack: [...state.redoStack, undone],
        current: replayActions(state.baseline, newLog),
      };
    }
    case "REDO_GROUP": {
      // Find last undone action for this groupKey and re-apply it
      const idx = findLastIndex(state.redoStack, (a) => a.groupKey === action.groupKey);
      if (idx === -1) return state;
      const redone = state.redoStack[idx];
      const newLog = [...state.actionLog, redone];
      const newRedo = [...state.redoStack.slice(0, idx), ...state.redoStack.slice(idx + 1)];
      return { ...state, actionLog: newLog, redoStack: newRedo, current: replayActions(state.baseline, newLog) };
    }
    case "REVERT_GROUP": {
      const newLog = state.actionLog.filter((a) => a.groupKey !== action.groupKey);
      return { ...state, actionLog: newLog, redoStack: [], current: replayActions(state.baseline, newLog) };
    }
    case "REVERT_ALL": {
      return { ...state, actionLog: [], redoStack: [], current: [...state.baseline] };
    }
    case "RESTORE_SNAPSHOT": {
      return action.snapshot;
    }
    default:
      return state;
  }
}
