import { memo, useMemo, useCallback, useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { GANTT_LEFT_COL_WIDTH, HOURS_PER_DAY, JOB_CATEGORIES, MDS_EXTRACT_START } from "../../constants";
import { formatLocalDate } from "../../utils/dateUtils";
import {
  computeFillExtend,
  computeFillTruncate,
  computeReplace,
  computeTruncateFragments,
  computeFitIn,
} from "../../utils/assignmentModes";
import type { FitInOverride } from "../../utils/assignmentModes";
import { EditModeSelector } from "./EditModeSelector";
import {
  barSx,
  barInputSx,
  barDatePickerSx,
  barDatePickerPopperSx,
  barBtnInactive,
  barBtnDanger,
  barBtnAccent,
  barLabel,
  BAR_GAP,
  barDivider,
  getBarColor,
  parseLocalDate,
  toLocalDateStr,
  countWorkingDays,
} from "./bulkEditTypes";
import { brand } from "../../../../config/brandConfig";
import type {
  BulkSelection,
  DisplayGroup,
  BulkEditAction,
  LabelParts,
  InsertMode,
  PendingActionInfo,
} from "./bulkEditTypes";

const LEFT_COL = GANTT_LEFT_COL_WIDTH;

/** Advance date by N calendar days */
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── ToolBar props ──

type EditModeProps = {
  mode: "edit";
  selection: BulkSelection;
  selectedGroup: DisplayGroup;
  enabledHolidayDates: Set<string>;
  dispatchBatch: (actions: BulkEditAction[]) => void;
  onClearSelection: () => void;
  onSelectionChange: (sel: BulkSelection) => void;
  labelParts: LabelParts;
  leftColShrink: number;
  onPendingActionChange?: (info: PendingActionInfo) => void;
  onRevert?: () => void;
  onRevertConfirm?: () => void;
  onRevertCancel?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoRedoActive?: boolean;
  onUndoRedoApply?: () => void;
  onUndoRedoCancel?: () => void;
};

type CreateModeProps = {
  mode: "create";
  dateRange: { start: string; end: string };
  enabledHolidayDates: Set<string>;
  pipelineJobcodes: Map<string, any> | null;
  employee: any;
  onConfirm: (data: {
    jobNo: string;
    jobName: string;
    startDate: string;
    endDate: string;
    utilization: number;
    status: string;
    category: string;
    segments?: any[];
    effectiveEndDate?: string;
    replaceOverlapping?: any[];
    fitInOverrides?: FitInOverride[];
  }) => void;
  onCancel: () => void;
  onDateChange: (range: { start: string; end: string }) => void;
  onUtilizationChange: (util: number) => void;
  onSegmentsChange: (segments: { startDate: string; endDate: string; utilization: number }[] | null) => void;
  onExistingOverrides: (
    overrides:
      | {
          origJobNo: string;
          origStartDate: string;
          replacements: { startDate: string; endDate: string; utilization: number }[];
        }[]
      | null
  ) => void;
  presetJobNo?: string;
  presetJobName?: string;
  presetClient?: string;
  presetCategory?: string;
  presetUtilization?: number;
  leftColShrink: number;
};

export type ToolBarProps = EditModeProps | CreateModeProps;

export const ToolBar = memo((props: ToolBarProps) => {
  const isEdit = props.mode === "edit";

  // ── Edit mode state ──
  const [pendingAction, setPendingActionRaw] = useState<"truncate" | "reduce_util" | "reduce_days" | "revert" | "">("");
  const [reduceUtil, setReduceUtilRaw] = useState(50);
  const [reduceDays, setReduceDaysRaw] = useState(5);

  const onPendingRef = useRef(isEdit ? props.onPendingActionChange : undefined);
  onPendingRef.current = isEdit ? props.onPendingActionChange : undefined;

  const setPendingAction = useCallback((a: typeof pendingAction) => {
    setPendingActionRaw(a);
  }, []);
  const setReduceUtil = useCallback((v: number) => {
    setReduceUtilRaw(v);
  }, []);
  const setReduceDays = useCallback((v: number) => {
    setReduceDaysRaw(v);
  }, []);

  // Reset edit state when switching between groups
  const prevGroupKeyRef = useRef(isEdit ? props.selectedGroup?.groupKey : null);
  useEffect(() => {
    const key = isEdit ? props.selectedGroup?.groupKey : null;
    if (key !== prevGroupKeyRef.current) {
      prevGroupKeyRef.current = key;
      setPendingActionRaw("");
      setReduceUtilRaw(50);
      setReduceDaysRaw(5);
    }
  }, [isEdit, isEdit ? props.selectedGroup?.groupKey : null]);

  // Notify parent of pending action changes
  useEffect(() => {
    if (!isEdit || !onPendingRef.current) return;
    if (pendingAction) {
      onPendingRef.current({ action: pendingAction, reduceUtil, reduceDays });
    } else {
      onPendingRef.current(null);
    }
  }, [isEdit, pendingAction, reduceUtil, reduceDays]);

  // ── Create mode state ──
  const cp = props as CreateModeProps;
  const [jobNo, setJobNo] = useState(!isEdit ? cp.presetJobNo || "" : "");
  const [jobName, setJobName] = useState(!isEdit ? cp.presetJobName || "" : "");
  const [utilization, setUtilization] = useState<number | "">(cp.presetUtilization || "");
  const [clientFilter, setClientFilter] = useState("");

  // Sync create state when presets change (e.g. switching from new → gap fill, or gap fill → new)
  const prevPresetsRef = useRef({ jobNo: cp.presetJobNo, jobName: cp.presetJobName, client: cp.presetClient });
  useEffect(() => {
    if (isEdit) return;
    const prev = prevPresetsRef.current;
    const changed =
      prev.jobNo !== cp.presetJobNo || prev.jobName !== cp.presetJobName || prev.client !== cp.presetClient;
    prevPresetsRef.current = { jobNo: cp.presetJobNo, jobName: cp.presetJobName, client: cp.presetClient };
    if (!changed) return;
    setJobNo(cp.presetJobNo || "");
    setJobName(cp.presetJobName || "");
    setClientFilter(cp.presetClient || "");
    const presetUtil = cp.presetUtilization || "";
    setUtilization(presetUtil);
    if (typeof presetUtil === "number") cp.onUtilizationChange(presetUtil);
    setInsertMode("");
  }, [isEdit, cp.presetJobNo, cp.presetJobName, cp.presetClient]);
  const [insertMode, setInsertMode] = useState<InsertMode>("");

  // ── Shared: date range & working days ──
  const dateStart = isEdit ? props.selection.subRange?.start || props.selectedGroup.startDate : props.dateRange.start;
  const dateEnd = isEdit ? props.selection.subRange?.end || props.selectedGroup.endDate : props.dateRange.end;
  const hasSubRange = isEdit && !!props.selection.subRange;

  const workingDays = useMemo(
    () => {
      if (isEdit) {
        const rangeStart = hasSubRange ? props.selection.subRange!.start : props.selectedGroup.startDate;
        const rangeEnd = hasSubRange ? props.selection.subRange!.end : props.selectedGroup.endDate;
        let total = 0;
        for (const item of props.selectedGroup.items) {
          if (item.isDeleted) continue;
          const overlapStart = item.startDate > rangeStart ? item.startDate : rangeStart;
          const overlapEnd = item.endDate < rangeEnd ? item.endDate : rangeEnd;
          if (overlapStart <= overlapEnd) {
            total += countWorkingDays(overlapStart, overlapEnd, props.enabledHolidayDates);
          }
        }
        return total;
      }
      return countWorkingDays(props.dateRange.start, props.dateRange.end, props.enabledHolidayDates);
    },
    isEdit
      ? [hasSubRange, props.selection, props.selectedGroup, props.enabledHolidayDates]
      : [props.dateRange, props.enabledHolidayDates]
  );

  // ── Edit mode logic ──
  const overlapping = isEdit
    ? (s: string, e: string) =>
        props.selectedGroup.items.filter((i) => !i.isDeleted && i.startDate <= e && i.endDate >= s)
    : () => [];

  const handleApply = () => {
    if (!isEdit) return;
    const rawS = hasSubRange ? props.selection.subRange!.start : props.selectedGroup.startDate;
    const s = rawS > MDS_EXTRACT_START ? rawS : MDS_EXTRACT_START;
    const e = hasSubRange ? props.selection.subRange!.end : props.selectedGroup.endDate;
    // Treat as sub-range when MDS_EXTRACT_START clips the start (use SPLIT_DELETE, not TOGGLE_DELETE)
    const effectiveSubRange = hasSubRange || s > props.selectedGroup.startDate;
    if (pendingAction === "truncate") {
      if (effectiveSubRange) {
        const actions: BulkEditAction[] = overlapping(s, e).map((i) => ({
          type: "SPLIT_DELETE" as const,
          tempId: i.tempId,
          start: s,
          end: e,
        }));
        if (actions.length > 0) props.dispatchBatch(actions);
      } else {
        const actions: BulkEditAction[] = props.selectedGroup.items
          .filter((i) => !i.isDeleted)
          .map((i) => ({ type: "TOGGLE_DELETE" as const, tempId: i.tempId }));
        if (actions.length > 0) props.dispatchBatch(actions);
      }
    } else if (pendingAction === "reduce_util") {
      const actions: BulkEditAction[] = overlapping(s, e).map((i) => ({
        type: "REDUCE_UTIL" as const,
        tempId: i.tempId,
        start: s,
        end: e,
        newUtil: reduceUtil,
      }));
      if (actions.length > 0) props.dispatchBatch(actions);
    } else if (pendingAction === "reduce_days") {
      const actions: BulkEditAction[] = overlapping(s, e).map((i) => ({
        type: "REDUCE_DAYS" as const,
        tempId: i.tempId,
        start: s,
        end: e,
        keepDays: reduceDays,
        holidays: props.enabledHolidayDates,
      }));
      if (actions.length > 0) props.dispatchBatch(actions);
    } else if (pendingAction === "revert" && isEdit && props.onRevertConfirm) {
      props.onRevertConfirm();
    }
    setPendingAction("");
    props.onClearSelection();
  };

  const handleEditCancel = () => {
    if (!isEdit) return;
    setPendingAction("");
    props.onClearSelection();
  };

  // ── Create mode logic ──
  const util = typeof utilization === "number" ? utilization : 0;

  const conflictWarning = useMemo(
    () => {
      if (isEdit || !props.dateRange.start || !props.dateRange.end || !util) return null;
      let maxOverlapUtil = 0;
      let maxOverlapDate: string | null = null;
      const cursor = new Date(props.dateRange.start);
      const end = new Date(props.dateRange.end);
      while (cursor <= end) {
        const dateStr = formatLocalDate(cursor);
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6 && !props.enabledHolidayDates.has(dateStr)) {
          let dayUtil = 0;
          props.employee.assignments.forEach((a: any) => {
            if (dateStr >= a.startDate && dateStr <= a.endDate) dayUtil += a.utilization;
          });
          const totalUtil = dayUtil + util;
          if (totalUtil > maxOverlapUtil) {
            maxOverlapUtil = totalUtil;
            maxOverlapDate = dateStr;
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      if (maxOverlapUtil > 100) {
        return {
          maxUtil: maxOverlapUtil,
          peakDate: maxOverlapDate ? new Date(maxOverlapDate).toLocaleDateString("fr-FR") : null,
          severity: maxOverlapUtil > 150 ? "critical" : "warning",
        };
      }
      return null;
    },
    isEdit ? [] : [props.dateRange, util, props.employee, props.enabledHolidayDates]
  );

  const fillResult = useMemo(
    () => {
      if (isEdit || !conflictWarning || !props.dateRange.start || !props.dateRange.end || !util)
        return { extend: null, truncate: null };
      const extend = computeFillExtend(
        props.employee,
        props.dateRange.start,
        props.dateRange.end,
        util,
        props.enabledHolidayDates,
        null
      );
      const truncate = computeFillTruncate(
        props.employee,
        props.dateRange.start,
        props.dateRange.end,
        util,
        props.enabledHolidayDates,
        null
      );
      return { extend, truncate };
    },
    isEdit ? [] : [conflictWarning, props.employee, props.dateRange, util, props.enabledHolidayDates]
  );

  const replaceResult = useMemo(
    () => {
      if (isEdit || !conflictWarning || !props.dateRange.start || !props.dateRange.end || !util) return null;
      return computeReplace(props.employee, props.dateRange.start, props.dateRange.end, util);
    },
    isEdit ? [] : [conflictWarning, props.employee, props.dateRange, util]
  );

  const fitInResult = useMemo(
    () => {
      if (isEdit || !conflictWarning || !props.dateRange.start || !props.dateRange.end || !util) return null;
      return computeFitIn(
        props.employee,
        props.dateRange.start,
        props.dateRange.end,
        util,
        props.enabledHolidayDates,
        null
      );
    },
    isEdit ? [] : [conflictWarning, props.employee, props.dateRange, util, props.enabledHolidayDates]
  );

  useEffect(() => {
    if (!conflictWarning) setInsertMode("");
  }, [conflictWarning]);

  useEffect(() => {
    if (isEdit) return;
    if (insertMode === "fill_extend" && fillResult.extend) props.onSegmentsChange(fillResult.extend.segments);
    else if (insertMode === "fill_truncate" && fillResult.truncate)
      props.onSegmentsChange(fillResult.truncate.segments);
    else props.onSegmentsChange(null);
  }, [insertMode, fillResult, isEdit ? null : props.onSegmentsChange]);

  useEffect(() => {
    if (isEdit) return;
    if (insertMode === "replace" && replaceResult && replaceResult.overlapping.length > 0) {
      const overrides: {
        origJobNo: string;
        origStartDate: string;
        replacements: { startDate: string; endDate: string; utilization: number }[];
      }[] = [];
      for (const ov of replaceResult.overlapping) {
        const frags = computeTruncateFragments(ov, ov.overlapStart, ov.overlapEnd);
        overrides.push({ origJobNo: ov.jobNo, origStartDate: ov.startDate, replacements: frags });
      }
      props.onExistingOverrides(overrides);
    } else if (insertMode === "fit_in" && fitInResult && fitInResult.overrides.length > 0) {
      const grouped = new Map<string, typeof fitInResult.overrides>();
      for (const o of fitInResult.overrides) {
        const key = `${o.jobNo}::${o.startDate}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(o);
      }
      const overrides: {
        origJobNo: string;
        origStartDate: string;
        replacements: { startDate: string; endDate: string; utilization: number }[];
      }[] = [];
      for (const [, ovs] of grouped) {
        const a = ovs[0];
        const sorted = [...ovs].sort((x, y) => (x.overlapStart < y.overlapStart ? -1 : 1));
        const replacements: { startDate: string; endDate: string; utilization: number }[] = [];
        let cursor = a.startDate;
        for (const o of sorted) {
          if (cursor < o.overlapStart)
            replacements.push({
              startDate: cursor,
              endDate: addDays(o.overlapStart, -1),
              utilization: a.originalUtilization,
            });
          replacements.push({ startDate: o.overlapStart, endDate: o.overlapEnd, utilization: o.newUtilization });
          cursor = addDays(o.overlapEnd, 1);
        }
        if (cursor <= a.endDate)
          replacements.push({ startDate: cursor, endDate: a.endDate, utilization: a.originalUtilization });
        overrides.push({ origJobNo: a.jobNo, origStartDate: a.startDate, replacements });
      }
      props.onExistingOverrides(overrides);
    } else {
      props.onExistingOverrides(null);
    }
  }, [insertMode, replaceResult, fitInResult, isEdit ? null : props.onExistingOverrides]);

  const pipelineJobcodes = !isEdit ? props.pipelineJobcodes : null;
  const allJobcodeOptions = useMemo(() => {
    if (!pipelineJobcodes) return [];
    const opts: { jobNo: string; jobName: string; account: string }[] = [];
    pipelineJobcodes.forEach((info: any, key: string) => {
      if (info.opportunityName && info.status !== "Déclassé")
        opts.push({ jobNo: key, jobName: info.opportunityName, account: info.account || "" });
    });
    return opts;
  }, [pipelineJobcodes]);

  const clientOptions = useMemo(() => {
    const accounts = new Set<string>();
    allJobcodeOptions.forEach(({ account }) => {
      if (account) accounts.add(account);
    });
    return Array.from(accounts).sort();
  }, [allJobcodeOptions]);

  const jobcodeOptions = useMemo(() => {
    const filtered = clientFilter ? allJobcodeOptions.filter((o) => o.account === clientFilter) : allJobcodeOptions;
    return [...filtered].sort((a, b) => a.jobNo.localeCompare(b.jobNo, undefined, { numeric: true }));
  }, [allJobcodeOptions, clientFilter]);

  const handleJobNoChange = useCallback(
    (_e: any, newValue: string | { jobNo: string; jobName: string; account?: string } | null) => {
      if (!newValue) {
        setJobNo("");
        return;
      }
      if (typeof newValue === "string") {
        setJobNo(newValue);
        const info = pipelineJobcodes?.get(newValue);
        if (info?.opportunityName) {
          setJobNo(newValue);
          setJobName(info.opportunityName);
          if (info.account) setClientFilter(info.account);
        }
      } else {
        setJobNo(newValue.jobNo);
        setJobName(newValue.jobName);
        if (newValue.account) setClientFilter(newValue.account);
      }
    },
    [pipelineJobcodes]
  );

  const handleUtilChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isEdit) return;
      const val = e.target.value === "" ? ("" as const) : Number(e.target.value);
      setUtilization(val);
      props.onUtilizationChange(typeof val === "number" ? val : 0);
    },
    [isEdit ? null : props.onUtilizationChange]
  );

  const fillExtendDisabled = !!(fillResult.extend && fillResult.extend.segments.length === 0);
  const fillTruncDisabled = !!(fillResult.truncate && fillResult.truncate.segments.length === 0);
  const fitInDisabled = !!(fitInResult && !fitInResult.feasible);
  const fillSegmentsEmpty =
    (insertMode === "fill_extend" && fillExtendDisabled) || (insertMode === "fill_truncate" && fillTruncDisabled);
  const canSave =
    !isEdit &&
    dateStart &&
    dateEnd &&
    dateStart <= dateEnd &&
    util > 0 &&
    !!jobNo &&
    !!jobName &&
    (!conflictWarning || !!insertMode) &&
    !fillSegmentsEmpty &&
    (insertMode !== "fit_in" || !fitInDisabled);

  const handleCreate = useCallback(() => {
    if (isEdit || !canSave) return;
    const presetCategory = cp.presetCategory;
    const payload: any = {
      jobNo,
      jobName,
      startDate: cp.dateRange.start,
      endDate: cp.dateRange.end,
      utilization: util,
      status: "C",
      category: presetCategory || JOB_CATEGORIES.CHARGEABLE,
    };
    if (insertMode === "fill_extend" && fillResult.extend) {
      payload.segments = fillResult.extend.segments;
      payload.effectiveEndDate = fillResult.extend.effectiveEndDate;
    } else if (insertMode === "fill_truncate" && fillResult.truncate) payload.segments = fillResult.truncate.segments;
    else if (insertMode === "replace" && replaceResult) payload.replaceOverlapping = replaceResult.overlapping;
    else if (insertMode === "fit_in" && fitInResult) payload.fitInOverrides = fitInResult.overrides;
    props.onConfirm(payload);
  }, [
    jobNo,
    jobName,
    isEdit ? null : cp.dateRange,
    util,
    canSave,
    isEdit ? null : cp.onConfirm,
    insertMode,
    fillResult,
    replaceResult,
    fitInResult,
  ]);

  // ── Shared rendering ──
  const hasActions = isEdit || !!conflictWarning;
  const effectiveLeft = LEFT_COL - props.leftColShrink;

  return (
    <Box sx={barSx}>
      {/* Left col — mirrors BulkEditRow column structure for vertical alignment */}
      <Box
        sx={{
          flexShrink: 0,
          px: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          minWidth: 0,
          borderLeft: "3px solid transparent",
        }}
        style={{ width: effectiveLeft - 3 }}
      >
        {/* Colored dot matching BulkEditRow */}
        <Box
          sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, ml: 1.5 }}
          style={{
            backgroundColor: getBarColor(
              isEdit ? props.selectedGroup.category : cp.presetCategory || JOB_CATEGORIES.CHARGEABLE
            ),
          }}
        />
        {/* Client / account area — flex:1 like BulkEditRow name */}
        {isEdit ? (
          props.labelParts.account ? (
            <Box component="span" sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, gap: 0.25 }}>
              <Typography
                component="span"
                sx={{
                  fontSize: "0.8125rem",
                  color: "text.primary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {props.labelParts.account}
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontSize: "0.8125rem",
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {props.labelParts.oppName}
              </Typography>
            </Box>
          ) : (
            <Typography
              sx={{
                fontSize: "0.8125rem",
                color: "text.primary",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                minWidth: 0,
              }}
            >
              {props.labelParts.name}
            </Typography>
          )
        ) : (
          <>
            {cp.presetJobNo ? (
              <Box component="span" sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, gap: 0.25 }}>
                {cp.presetClient && (
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "0.8125rem",
                      color: "text.primary",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {cp.presetClient}
                  </Typography>
                )}
                <Typography
                  component="span"
                  sx={{
                    fontSize: "0.8125rem",
                    color: cp.presetClient ? "text.secondary" : "text.primary",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {cp.presetJobName || cp.presetJobNo}
                </Typography>
              </Box>
            ) : (
              <>
                {clientOptions.length > 0 ? (
                  <Autocomplete
                    size="small"
                    options={clientOptions}
                    value={clientFilter || null}
                    onChange={(_e: any, val: any) => setClientFilter(val || "")}
                    popupIcon={null}
                    renderInput={(params) => <TextField {...params} placeholder="Site" sx={barInputSx} />}
                    renderOption={(p, opt: any) => (
                      <li {...p} key={opt}>
                        <Typography sx={{ fontSize: "0.7rem" }}>{opt}</Typography>
                      </li>
                    )}
                    slotProps={{
                      popper: { sx: { minWidth: 300 }, placement: "bottom-start" },
                      listbox: { sx: { scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } } },
                    }}
                    sx={{
                      flex: 1,
                      minWidth: 100,
                      "& .MuiAutocomplete-input": {
                        p: "2px 4px !important",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      },
                    }}
                  />
                ) : (
                  <Box sx={{ flex: 1 }} />
                )}
              </>
            )}
          </>
        )}
        {/* Jobcode area — aligned with jobNo column (60px) */}
        {isEdit ? (
          <Typography
            component="span"
            sx={{ fontSize: "0.7rem", color: "text.secondary", flexShrink: 0, width: 60, textAlign: "right" }}
          >
            {props.labelParts.jobNo}
          </Typography>
        ) : !cp.presetJobNo ? (
          <Autocomplete
            size="small"
            freeSolo
            openOnFocus={!!clientFilter}
            options={jobcodeOptions}
            value={jobcodeOptions.find((o) => o.jobNo === jobNo) || null}
            inputValue={jobNo}
            onInputChange={(_e: any, val: string) => setJobNo(val)}
            onChange={handleJobNoChange}
            getOptionLabel={(opt: any) => (typeof opt === "string" ? opt : opt.jobNo)}
            renderOption={(p, opt: any) => (
              <li {...p} key={opt.jobNo}>
                <Box>
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 600 }}>{opt.jobNo}</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>{opt.jobName}</Typography>
                </Box>
              </li>
            )}
            filterOptions={(options, state) => {
              const q = state.inputValue.toLowerCase();
              const limit = clientFilter ? Infinity : 50;
              if (!q) return options.slice(0, limit);
              const filtered = options.filter(
                (o: any) => o.jobNo.toLowerCase().includes(q) || o.jobName.toLowerCase().includes(q)
              );
              return clientFilter ? filtered : filtered.slice(0, 50);
            }}
            renderInput={(params) => <TextField {...params} placeholder="Job code" sx={barInputSx} />}
            slotProps={{
              popper: { sx: { minWidth: 360 }, placement: "bottom-start" },
              listbox: { sx: { scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } } },
            }}
            sx={{ width: 100, flexShrink: 0 }}
          />
        ) : (
          <Typography
            component="span"
            sx={{ fontSize: "0.7rem", color: "text.secondary", flexShrink: 0, width: 60, textAlign: "right" }}
          >
            {cp.presetJobNo}
          </Typography>
        )}
        {/* hours — aligned with labelParts.hours (40px) */}
        <Typography
          component="span"
          sx={{ fontSize: "0.7rem", color: "text.secondary", flexShrink: 0, width: 40, textAlign: "right" }}
        >
          {isEdit ? props.labelParts.hours : `${Math.round(workingDays * (util / 100) * HOURS_PER_DAY)}h`}
        </Typography>
        {/* days — aligned with labelParts.days (32px) */}
        <Typography
          component="span"
          sx={{
            fontSize: "0.7rem",
            color: brand.secondaryLight,
            fontWeight: 600,
            flexShrink: 0,
            width: 32,
            textAlign: "right",
          }}
        >
          {workingDays}d
        </Typography>
        {/* badges placeholder (64px) to match BulkEditRow */}
        <Box sx={{ width: 64, flexShrink: 0 }} />
      </Box>

      {/* Right col — dates, %, actions & buttons */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: `${BAR_GAP}px`, minWidth: 0, pr: 1.5 }}>
        {/* Dates */}
        {isEdit ? (
          hasSubRange ? (
            <>
              <DatePicker
                value={parseLocalDate(props.selection.subRange!.start)}
                onChange={(d) => {
                  const s = toLocalDateStr(d);
                  if (s)
                    props.onSelectionChange({
                      ...props.selection,
                      subRange: { ...props.selection.subRange!, start: s },
                    });
                }}
                minDate={parseLocalDate(props.selectedGroup.startDate) ?? undefined}
                maxDate={parseLocalDate(props.selection.subRange!.end) ?? undefined}
                slotProps={{ popper: { sx: barDatePickerPopperSx } }}
                sx={barDatePickerSx}
              />
              <Typography sx={barLabel}>&rarr;</Typography>
              <DatePicker
                value={parseLocalDate(props.selection.subRange!.end)}
                onChange={(d) => {
                  const s = toLocalDateStr(d);
                  if (s)
                    props.onSelectionChange({ ...props.selection, subRange: { ...props.selection.subRange!, end: s } });
                }}
                minDate={parseLocalDate(props.selection.subRange!.start) ?? undefined}
                maxDate={parseLocalDate(props.selectedGroup.endDate) ?? undefined}
                slotProps={{ popper: { sx: barDatePickerPopperSx } }}
                sx={barDatePickerSx}
              />
            </>
          ) : (
            <Typography sx={{ ...barLabel, fontWeight: 600 }}>All</Typography>
          )
        ) : (
          <>
            <DatePicker
              value={parseLocalDate(props.dateRange.start)}
              onChange={(d) => {
                const s = toLocalDateStr(d);
                if (s) props.onDateChange({ ...props.dateRange, start: s });
              }}
              slotProps={{ popper: { sx: barDatePickerPopperSx } }}
              sx={barDatePickerSx}
            />
            <Typography sx={barLabel}>&rarr;</Typography>
            <DatePicker
              value={parseLocalDate(props.dateRange.end)}
              onChange={(d) => {
                const s = toLocalDateStr(d);
                if (s) props.onDateChange({ ...props.dateRange, end: s });
              }}
              slotProps={{ popper: { sx: barDatePickerPopperSx } }}
              sx={barDatePickerSx}
            />
          </>
        )}
        {/* Utilization % — after dates */}
        {!isEdit && (
          <>
            <TextField
              size="small"
              type="number"
              inputProps={{ min: 0, max: 200, step: 5 }}
              value={utilization}
              onChange={handleUtilChange}
              placeholder="%"
              sx={{ width: 56, flexShrink: 0, ...barInputSx }}
            />
            <Typography sx={barLabel}>%</Typography>
          </>
        )}

        {/* Divider before actions */}
        {hasActions && <Box sx={barDivider} />}
        {/* Actions — delegated to EditModeSelector */}
        {hasActions &&
          (isEdit ? (
            <EditModeSelector
              mode="edit"
              isDeleted={props.selectedGroup.isDeleted}
              pendingAction={pendingAction}
              onPendingActionChange={setPendingAction}
              reduceUtil={reduceUtil}
              onReduceUtilChange={setReduceUtil}
              reduceDays={reduceDays}
              onReduceDaysChange={setReduceDays}
              workingDays={workingDays}
              onRevert={props.onRevert}
              onRevertCancel={props.onRevertCancel}
            />
          ) : (
            <EditModeSelector
              mode="create"
              insertMode={insertMode}
              onInsertModeChange={setInsertMode}
              fillExtendDisabled={fillExtendDisabled}
              fillTruncDisabled={fillTruncDisabled}
              fitInDisabled={fitInDisabled}
            />
          ))}

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Undo/Redo (edit mode only) */}
        {isEdit && (props.canUndo || props.canRedo) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
            <IconButton
              size="small"
              aria-label="Undo"
              disabled={!props.canUndo}
              onClick={props.onUndo}
              sx={{ p: 0.5, "&.Mui-disabled": { opacity: 0.3 } }}
            >
              <UndoIcon sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Redo"
              disabled={!props.canRedo}
              onClick={props.onRedo}
              sx={{ p: 0.5, "&.Mui-disabled": { opacity: 0.3 } }}
            >
              <RedoIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
        )}

        {/* Cancel & Apply/Create */}
        <Box sx={{ display: "flex", alignItems: "center", gap: `${BAR_GAP}px`, flexShrink: 0 }}>
          {isEdit && props.undoRedoActive ? (
            <>
              <Button size="small" onClick={props.onUndoRedoCancel} sx={barBtnInactive}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={props.onUndoRedoApply} sx={{ ...barBtnAccent(true) }}>
                Apply
              </Button>
            </>
          ) : (
            <>
              <Button size="small" onClick={isEdit ? handleEditCancel : props.onCancel} sx={barBtnInactive}>
                Cancel
              </Button>
              {isEdit ? (
                (!props.selectedGroup.isDeleted || pendingAction === "revert") && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleApply}
                    disabled={!pendingAction}
                    sx={{
                      ...(pendingAction === "truncate" ? barBtnDanger(true) : barBtnAccent(true)),
                      "&.Mui-disabled": { bgcolor: brand.secondaryLightest, color: brand.secondaryLight },
                    }}
                  >
                    Apply
                  </Button>
                )
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!canSave}
                  sx={{
                    ...barBtnAccent(true),
                    "&.Mui-disabled": { bgcolor: brand.secondaryLightest, color: brand.secondaryLight },
                  }}
                >
                  Create
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
});
ToolBar.displayName = "ToolBar";
