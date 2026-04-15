/**
 * Custom hook encapsulating create mode state and handlers for BulkEditPanel.
 * Manages: create mode toggle, utilization, segments, existing overrides, prefill.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { CreateMode, EditAction, BaselineSegment } from "./bulkEditTypes";
import { buildCreateAction, buildSplitDeleteAction, buildReduceUtilMultiAction } from "./bulkEditEngine";
import { toDateString } from "../../utils/dateUtils";

interface PrefillData {
  empId: string;
  jobNo?: string;
  jobName?: string;
  startDate?: string;
  endDate?: string;
  utilization?: number;
  needId?: string;
}

interface UseBulkEditCreateModeParams {
  startWithAdd: boolean;
  prefill?: PrefillData | null;
  onClearPrefill?: (v: null) => void;
  pipelineJobcodes: Map<string, any> | null;
  employee: any;
  editorStateRef: React.MutableRefObject<{ current: BaselineSegment[] }>;
  dispatchAndPersist: (actions: EditAction[]) => void;
}

export function useBulkEditCreateMode({
  startWithAdd,
  prefill,
  onClearPrefill,
  pipelineJobcodes,
  employee,
  editorStateRef,
  dispatchAndPersist,
}: UseBulkEditCreateModeParams) {
  const [createMode, setCreateMode] = useState<CreateMode>(startWithAdd ? { type: "new", range: null } : null);
  const [createUtilization, setCreateUtilization] = useState(0);
  const [createSegments, setCreateSegments] = useState<
    { startDate: string; endDate: string; utilization: number }[] | null
  >(null);
  const [createExistingOverrides, setCreateExistingOverrides] = useState<
    | {
        origJobNo: string;
        origStartDate: string;
        replacements: { startDate: string; endDate: string; utilization: number }[];
      }[]
    | null
  >(null);

  const prefillNeedIdRef = useRef<string | undefined>(undefined);
  if (prefill?.needId) prefillNeedIdRef.current = prefill.needId;

  const prefillJobInfoRef = useRef<{ jobNo: string; jobName: string; account: string } | null>(null);
  if (prefill?.jobNo) {
    const info = pipelineJobcodes?.get(prefill.jobNo);
    prefillJobInfoRef.current = {
      jobNo: prefill.jobNo,
      jobName: prefill.jobName || info?.opportunityName || "",
      account: info?.account || "",
    };
  }
  const prefillJobInfo = prefillJobInfoRef.current;

  const clearCreate = useCallback(() => {
    setCreateMode(null);
    setCreateUtilization(0);
    setCreateSegments(null);
    setCreateExistingOverrides(null);
    prefillNeedIdRef.current = undefined;
  }, []);

  // External prefill: activate create mode with pre-filled job data
  const prefillConsumedRef = useRef(false);
  useEffect(() => {
    if (prefill && !prefillConsumedRef.current) {
      prefillConsumedRef.current = true;
      setCreateMode({
        type: "new",
        range: prefill.startDate && prefill.endDate ? { start: prefill.startDate, end: prefill.endDate } : null,
        jobNo: prefill.jobNo,
        jobName: prefill.jobName,
        utilization: prefill.utilization,
      });
      if (prefill.utilization) setCreateUtilization(prefill.utilization);
      onClearPrefill?.(null);
    }
  }, [prefill, onClearPrefill]);

  const handleCreateConfirm = useCallback(
    (data: any) => {
      // Validate & auto-swap inverted dates
      if (data.startDate && data.endDate && data.startDate > data.endDate) {
        [data.startDate, data.endDate] = [data.endDate, data.startDate];
      }
      const actions: EditAction[] = [];
      const curState = editorStateRef.current.current;
      const findSeg = (jobNo: string, startDate: string): BaselineSegment | undefined => {
        const sd = startDate;
        return curState.find((s) => s.jobNo === jobNo && s.startDate === sd);
      };
      // Handle replace overlapping
      if (data.replaceOverlapping?.length > 0) {
        for (const ov of data.replaceOverlapping) {
          const seg = findSeg(ov.jobNo, ov.startDate);
          if (seg) actions.push(buildSplitDeleteAction(seg, ov.overlapStart, ov.overlapEnd));
        }
      }
      // Handle fit_in overrides
      if (data.fitInOverrides?.length > 0) {
        const grouped = new Map<string, typeof data.fitInOverrides>();
        for (const ov of data.fitInOverrides) {
          const key = `${ov.jobNo}::${ov.startDate}`;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(ov);
        }
        for (const [, ovs] of grouped) {
          const seg = findSeg(ovs[0].jobNo, ovs[0].startDate);
          if (!seg) continue;
          if (ovs.length === 1 && ovs[0].newUtilization <= 0) {
            actions.push(buildSplitDeleteAction(seg, ovs[0].overlapStart, ovs[0].overlapEnd));
          } else {
            actions.push(
              buildReduceUtilMultiAction(
                seg,
                ovs.map((ov: any) => ({ start: ov.overlapStart, end: ov.overlapEnd, newUtil: ov.newUtilization }))
              )
            );
          }
        }
      }
      // Add the new assignment(s)
      const eid = employee._realEmpId || employee.empId;
      const needId = prefillNeedIdRef.current;
      const source = needId ? "staffing_need" : undefined;
      if (data.segments?.length > 0) {
        for (const seg of data.segments) {
          actions.push(
            buildCreateAction(eid, {
              jobNo: data.jobNo,
              jobName: data.jobName,
              startDate: seg.startDate,
              endDate: seg.endDate,
              utilization: seg.utilization,
              status: data.status,
              category: data.category,
              needId,
              source,
            })
          );
        }
      } else {
        actions.push(
          buildCreateAction(eid, {
            jobNo: data.jobNo,
            jobName: data.jobName,
            startDate: data.startDate,
            endDate: data.endDate,
            utilization: data.utilization,
            status: data.status,
            category: data.category,
            needId,
            source,
          })
        );
      }
      dispatchAndPersist(actions);
      clearCreate();
    },
    [employee, editorStateRef, dispatchAndPersist, clearCreate]
  );

  const handleCreateCancel = useCallback(() => clearCreate(), [clearCreate]);

  const handleCreateDateChange = useCallback((range: { start: string; end: string }) => {
    setCreateMode((prev) => (prev ? { ...prev, range } : null));
  }, []);

  return {
    createMode,
    setCreateMode,
    createUtilization,
    setCreateUtilization,
    createSegments,
    setCreateSegments,
    createExistingOverrides,
    setCreateExistingOverrides,
    clearCreate,
    prefillNeedIdRef,
    prefillJobInfo,
    handleCreateConfirm,
    handleCreateCancel,
    handleCreateDateChange,
  };
}
