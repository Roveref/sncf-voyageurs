import React, { useState, useCallback, useEffect, useRef } from "react";
import { toDateString } from "../utils/dateUtils";
import useScenarioStore from "../../../stores/useScenarioStore";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { assignmentKey } from "../utils/scenarioUtils";
import { getHoursPerDay } from "../constants";
import type { Employee, StaffingRecord } from "../types";

// MDS edits are persisted via EditorState (saved by BulkEditPanel → onEditorStateChange → useUserDataStore.setEditorState)
// No separate event log needed — editorState.current IS the final state.

/** A reference to an assignment (for delete/revert/drag operations) */
interface AssignmentRef {
  _uid?: string;
  empId: string;
  jobNo: string;
  jobName?: string;
  startDate: string;
  endDate?: string;
  utilization?: number;
  category?: string;
  [key: string]: unknown;
}

/** Dynamic assignment record from bulk-edit panel — all fields optional except empId */
interface BulkEditOpData {
  _uid?: string;
  empId?: string;
  jobNo?: string;
  jobName?: string;
  startDate?: string;
  endDate?: string;
  utilization?: number;
  category?: string;
  [key: string]: unknown;
}

/** A single bulk-edit operation */
export interface BulkEditOperation {
  type: "create" | "edit" | "delete";
  data?: BulkEditOpData;
  originalKey?: string;
  originalJobNo?: string;
  originalStartDate?: string;
  [key: string]: unknown;
}

/** Drag event data */
interface DragData {
  _uid?: string;
  empId: string;
  jobNo: string;
  oldStartDate: string;
  newStartDate: string;
  newEndDate: string;
  [key: string]: unknown;
}

/** Change history entry */
interface ChangeHistoryEntry {
  id: number | string;
  type: string;
  timestamp: Date;
  scenarioId?: string | null;
  employeeName: string;
  employeeId: string;
  jobName?: string;
  before: StaffingRecord | StaffingRecord[] | null;
  after: StaffingRecord | StaffingRecord[] | null;
  _operationCount?: number;
  _restored?: boolean;
  _jobNo?: string;
  _oldCategory?: string;
  _newCategory?: string;
  _selectedDates?: string[];
  [key: string]: unknown;
}

/** Editor state shape from persistence */
interface EditorState {
  actionLog?: unknown[];
  baseline?: StaffingRecord[];
  current?: StaffingRecord[];
  updatedAt?: string | number;
  [key: string]: unknown;
}

/** Find a record by _uid (preferred) or fallback to composite key */
const findByUid = (
  records: StaffingRecord[],
  uid: string | undefined,
  empId: string,
  jobNo: string,
  startDate: string,
  endDate?: string
): number =>
  uid
    ? records.findIndex((r) => r._uid === uid)
    : records.findIndex(
        (r) =>
          r.empId === empId &&
          r.jobNo === jobNo &&
          toDateString(r.startDate) === toDateString(startDate) &&
          (!endDate || toDateString(r.endDate) === toDateString(endDate))
      );

interface UseAssignmentEditorReturn {
  changeHistory: ChangeHistoryEntry[];
  handleDeleteAssignment: (assignment: AssignmentRef) => void;
  handleRevertAssignment: (assignment: AssignmentRef) => void;
  handleToggleCategory: (
    empId: string,
    jobNo: string,
    startDate: string,
    jobName: string,
    newCategory: string,
    selectedDates?: string[]
  ) => void;
  handleDragEnd: (dragData: DragData) => void;
  handleBulkSaveAssignment: (empId: string, operations: BulkEditOperation[]) => void;
}

/**
 * Custom hook encapsulating assignment CRUD operations and change history.
 *
 * @param {Function} setData - setState for raw data records
 * @param {Array} data - current raw records
 * @param {Array} enrichedGanttData - enriched employee objects
 * @returns {object}
 */
export const useAssignmentEditor = (
  setData: React.Dispatch<React.SetStateAction<StaffingRecord[]>>,
  data: StaffingRecord[],
  enrichedGanttData: Employee[]
): UseAssignmentEditorReturn => {
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryEntry[]>([]);

  // Reconstruct changeHistory from persisted editorStates (survives F5)
  // Each employee with an editorState that has actionLog entries = one history entry
  const restoredEditorStates = useUserDataStore((s) => s.editorStates);
  const historyRestoredRef = useRef(false);
  useEffect(() => {
    if (historyRestoredRef.current) return;
    const entries = Object.entries(restoredEditorStates);
    if (entries.length === 0) return;

    // Only restore once, and only if there are actual edits
    const hasEdits = entries.some(([, state]) => {
      const s = state as EditorState | null;
      return s?.actionLog && s.actionLog.length > 0;
    });
    if (!hasEdits) return;

    historyRestoredRef.current = true;

    const restoredHistory: ChangeHistoryEntry[] = [];
    for (const [empId, rawState] of entries) {
      const state = rawState as EditorState | null;
      if (!state?.actionLog?.length) continue;
      const emp = enrichedGanttData.find((e) => e.empId === empId || e._realEmpId === empId);
      restoredHistory.push({
        id: `restored_${empId}_${Date.now()}`,
        type: "bulk_edit",
        timestamp: new Date(state.updatedAt || Date.now()),
        employeeName: emp?.name || empId,
        employeeId: empId,
        before: state.baseline || [],
        after: state.current || [],
        _operationCount: state.actionLog.length,
        _restored: true,
      });
    }

    if (restoredHistory.length > 0) {
      setChangeHistory(restoredHistory);
    }
  }, [restoredEditorStates, enrichedGanttData]);

  // Scenario routing: when a scenario is active, mutations go to the scenario store
  const activeScenarioId = useScenarioStore((s) => s.activeScenarioId);
  const upsertOverride = useScenarioStore((s) => s.upsertAssignmentOverride);
  const removeOverride = useScenarioStore((s) => s.removeAssignmentOverride);
  const getActiveScenario = useScenarioStore((s) => s.getActiveScenario);

  // ── Helpers for building records ──────────────────────────────────────────
  const buildNewRecord = useCallback(
    (assignmentData: BulkEditOpData & { empId: string }, employee: Employee | undefined): StaffingRecord => {
      const nameParts = employee ? employee.name.split(" ") : ["", ""];
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const util = assignmentData.utilization ?? 100;
      return {
        ...assignmentData,
        empId: assignmentData.empId,
        jobNo: assignmentData.jobNo || "",
        jobName: assignmentData.jobName || "",
        startDate: assignmentData.startDate || "",
        endDate: assignmentData.endDate || "",
        utilization: util,
        category: assignmentData.category || "",
        _uid: assignmentData._uid || crypto.randomUUID(),
        lastName,
        firstName,
        hours: 0,
        startDateParsed: assignmentData.startDate,
        endDateParsed: assignmentData.endDate,
        utilPercent: `${util}%`,
        workingDays: 0,
        hoursTotal: 0,
        hoursPerDay: (util / 100) * getHoursPerDay(employee?.grade),
        isNew: true,
      } as StaffingRecord;
    },
    []
  );

  // ── Toggle category ────────────────────────────────────────────────────────
  const handleToggleCategory = useCallback(
    (
      empId: string,
      jobNo: string,
      startDate: string,
      jobName: string,
      newCategory: string,
      selectedDates?: string[]
    ): void => {
      // Helper: add N days to a YYYY-MM-DD string
      const addDays = (dateStr: string, n: number): string => {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };

      // ── Scenario mode ──
      if (activeScenarioId) {
        const matching = data.filter((r) => r.empId === empId && r.jobNo === jobNo);
        if (selectedDates && selectedDates.length > 0) {
          const sorted = [...selectedDates].sort();
          const minDate = sorted[0];
          const maxDate = sorted[sorted.length - 1];
          for (const r of matching) {
            const rStart = toDateString(r.startDate);
            const rEnd = toDateString(r.endDate);
            if (rEnd < minDate || rStart > maxDate) continue; // no overlap
            const key = assignmentKey(empId, jobNo, rStart);
            // Before fragment: edit original to truncate endDate (same key, no collision)
            if (rStart < minDate) {
              upsertOverride(key, {
                type: "edit",
                data: {
                  empId,
                  jobNo,
                  startDate: rStart,
                  endDate: addDays(minDate, -1),
                  utilization: r.utilization,
                  category: r.category,
                  jobName: r.jobName,
                },
              });
            } else {
              // No before fragment → delete original
              upsertOverride(key, { type: "delete", data: { empId, jobNo, startDate: rStart } });
            }
            // During fragment (new category)
            const dStart = rStart > minDate ? rStart : minDate;
            const dEnd = rEnd < maxDate ? rEnd : maxDate;
            const duringKey = assignmentKey(empId, jobNo, dStart);
            upsertOverride(duringKey, {
              type: "create",
              data: {
                empId,
                jobNo,
                startDate: dStart,
                endDate: dEnd,
                utilization: r.utilization,
                category: newCategory,
                jobName: r.jobName,
              },
            });
            // After fragment
            if (rEnd > maxDate) {
              const afterKey = assignmentKey(empId, jobNo, addDays(maxDate, 1));
              upsertOverride(afterKey, {
                type: "create",
                data: {
                  empId,
                  jobNo,
                  startDate: addDays(maxDate, 1),
                  endDate: rEnd,
                  utilization: r.utilization,
                  category: r.category,
                  jobName: r.jobName,
                },
              });
            }
          }
        } else {
          for (const r of matching) {
            const key = assignmentKey(empId, jobNo, toDateString(r.startDate));
            upsertOverride(key, {
              type: "edit",
              data: { empId, jobNo, startDate: toDateString(r.startDate), category: newCategory },
            });
          }
        }
        return;
      }

      // ── Real data mode ──
      const employee = enrichedGanttData.find((e) => e.empId === empId);
      const matchingRecords = data.filter((r) => r.empId === empId && r.jobNo === jobNo);

      setChangeHistory((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: "category_toggle",
          timestamp: new Date(),
          scenarioId: activeScenarioId || null,
          employeeName: employee?.name || empId,
          employeeId: empId,
          jobName: jobName || matchingRecords[0]?.jobName,
          before: matchingRecords.map((r) => ({ ...r })),
          after: null,
          _jobNo: jobNo,
          _oldCategory: matchingRecords[0]?.category,
          _newCategory: newCategory,
          _selectedDates: selectedDates,
        },
      ]);

      if (selectedDates && selectedDates.length > 0) {
        // Date-scoped toggle: split records at selection boundaries
        const sorted = [...selectedDates].sort();
        const minDate = sorted[0];
        const maxDate = sorted[sorted.length - 1];

        setData((prev) => {
          const next: StaffingRecord[] = [];
          for (const record of prev) {
            if (record.empId !== empId || record.jobNo !== jobNo) {
              next.push(record);
              continue;
            }
            const rStart = toDateString(record.startDate);
            const rEnd = toDateString(record.endDate);
            // No overlap — keep unchanged
            if (rEnd < minDate || rStart > maxDate) {
              next.push(record);
              continue;
            }

            // Before fragment (keep original category)
            if (rStart < minDate) {
              const beforeEnd = addDays(minDate, -1);

              next.push({ ...record, endDate: beforeEnd, endDateParsed: beforeEnd, isModified: true });
            }
            // During fragment (new category)
            const dStart = rStart > minDate ? rStart : minDate;
            const dEnd = rEnd < maxDate ? rEnd : maxDate;

            next.push({
              ...record,
              startDate: dStart,
              startDateParsed: dStart,
              endDate: dEnd,
              endDateParsed: dEnd,
              category: newCategory,
              isModified: true,
            });
            // After fragment (keep original category)
            if (rEnd > maxDate) {
              const afterStart = addDays(maxDate, 1);

              next.push({ ...record, startDate: afterStart, startDateParsed: afterStart, isModified: true });
            }
          }

          return next;
        });
      } else {
        // Full toggle: change all records for this jobNo
        setData((prev) =>
          prev.map((record) => {
            if (record.empId === empId && record.jobNo === jobNo) {
              return { ...record, category: newCategory, isModified: true };
            }
            return record;
          })
        );
      }
    },
    [data, enrichedGanttData, setData, activeScenarioId, upsertOverride]
  );

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteAssignment = useCallback(
    (assignment: AssignmentRef): void => {
      if (window.confirm("Are you sure you want to delete this assignment?")) {
        // ── Scenario mode ──
        if (activeScenarioId) {
          const key = assignmentKey(
            assignment.empId,
            assignment.jobNo,
            toDateString(assignment.startDate),
            assignment.endDate ? toDateString(assignment.endDate) : undefined
          );
          upsertOverride(key, {
            type: "delete",
            data: {
              empId: assignment.empId,
              jobNo: assignment.jobNo,
              startDate: toDateString(assignment.startDate),
              ...(assignment.endDate ? { endDate: toDateString(assignment.endDate) } : {}),
            },
          });
          return;
        }

        // ── Real data mode ──
        const idx = findByUid(data, assignment._uid, assignment.empId, assignment.jobNo, assignment.startDate);
        const originalRecord = idx !== -1 ? data[idx] : null;
        const employee = enrichedGanttData.find((e) => e.empId === assignment.empId);

        setChangeHistory((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            type: "delete",
            timestamp: new Date(),
            scenarioId: activeScenarioId || null,
            employeeName: employee?.name || assignment.empId,
            employeeId: assignment.empId,
            jobName: assignment.jobName,
            before: originalRecord ? { ...originalRecord } : null,
            after: null,
          },
        ]);

        setData((prev) =>
          prev.filter(
            (record) =>
              !(
                record.empId === assignment.empId &&
                record.jobNo === assignment.jobNo &&
                toDateString(record.startDate) === toDateString(assignment.startDate)
              )
          )
        );
      }
    },
    [setData, data, enrichedGanttData, activeScenarioId, upsertOverride]
  );

  // ── Revert a single assignment (undo scenario overrides or real-data bulk edit) ──
  const handleRevertAssignment = useCallback(
    (assignment: AssignmentRef): void => {
      // Resolve empId the same way as bulk save (handle grade-split virtual empIds)
      const employee = enrichedGanttData.find((e) => e.empId === assignment.empId || e._realEmpId === assignment.empId);
      const empId = employee?._realEmpId || assignment.empId;
      // ── Scenario mode: remove all overrides matching empId + jobNo ──
      if (activeScenarioId) {
        const scenario = getActiveScenario();
        if (!scenario) return;
        const overrides = scenario.assignmentOverrides || {};
        const prefix = `${empId}::${assignment.jobNo}::`;
        const keysToRemove = Object.keys(overrides).filter((k) => k.startsWith(prefix));
        for (const key of keysToRemove) removeOverride(key);
        return;
      }

      // ── Real data mode: find the bulk_edit history entry and restore the original records for this job ──
      const currentScenario = activeScenarioId || null;
      const historyEntry = [...changeHistory]
        .reverse()
        .find(
          (h) =>
            h.type === "bulk_edit" &&
            h.employeeId === empId &&
            (h.scenarioId || null) === currentScenario &&
            ((Array.isArray(h.before) && h.before.some((b) => b.jobNo === assignment.jobNo)) ||
              (Array.isArray(h.after) && h.after.some((a) => a.jobNo === assignment.jobNo)))
        );
      if (!historyEntry) return;

      const afterArr = Array.isArray(historyEntry.after) ? historyEntry.after : [];
      const beforeArr = Array.isArray(historyEntry.before) ? historyEntry.before : [];
      const afterForJob = afterArr.filter((a) => a.empId === empId && a.jobNo === assignment.jobNo);
      const beforeForJob = beforeArr.filter((b) => b.empId === empId && b.jobNo === assignment.jobNo);

      setData((prev) => {
        let next = [...prev];
        for (const a of afterForJob) {
          const idx = next.findIndex(
            (r) => r.empId === a.empId && r.jobNo === a.jobNo && toDateString(r.startDate) === toDateString(a.startDate)
          );
          if (idx !== -1) next.splice(idx, 1);
        }
        for (const b of beforeForJob) {
          next.push({ ...b });
        }
        return next;
      });
    },
    [activeScenarioId, getActiveScenario, removeOverride, changeHistory, setData, enrichedGanttData]
  );

  // ── Drag end ──────────────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (dragData: DragData): void => {
      // ── Scenario mode ──
      if (activeScenarioId) {
        const key = assignmentKey(dragData.empId, dragData.jobNo, toDateString(dragData.newStartDate));
        upsertOverride(key, {
          type: "edit",
          data: {
            empId: dragData.empId,
            jobNo: dragData.jobNo,
            startDate: toDateString(dragData.newStartDate),
            endDate: dragData.newEndDate,
          },
        });
        // Also remove the old key if the start date changed
        const oldKey = assignmentKey(dragData.empId, dragData.jobNo, toDateString(dragData.oldStartDate));
        if (oldKey !== key) removeOverride(oldKey);
        return;
      }

      // ── Real data mode ──
      const dragIdx = findByUid(data, dragData._uid, dragData.empId, dragData.jobNo, dragData.oldStartDate);
      const originalRecord = dragIdx !== -1 ? data[dragIdx] : null;
      const employee = enrichedGanttData.find((e) => e.empId === dragData.empId);

      setChangeHistory((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: "drag",
          timestamp: new Date(),
          scenarioId: activeScenarioId || null,
          employeeName: employee?.name || dragData.empId,
          employeeId: dragData.empId,
          jobName: originalRecord?.jobName || dragData.jobNo,
          before: originalRecord ? { ...originalRecord } : null,
          after: originalRecord
            ? {
                ...originalRecord,
                startDate: dragData.newStartDate,
                endDate: dragData.newEndDate,
                startDateParsed: dragData.newStartDate,
                endDateParsed: dragData.newEndDate,
              }
            : null,
        },
      ]);

      setData((prev) =>
        prev.map((record) => {
          if (
            record.empId === dragData.empId &&
            record.jobNo === dragData.jobNo &&
            toDateString(record.startDate) === toDateString(dragData.oldStartDate)
          ) {
            return {
              ...record,
              startDate: dragData.newStartDate,
              endDate: dragData.newEndDate,
              startDateParsed: dragData.newStartDate,
              endDateParsed: dragData.newEndDate,
              isModified: true,
            };
          }
          return record;
        })
      );
    },
    [setData, data, enrichedGanttData, activeScenarioId, upsertOverride, removeOverride]
  );

  // ── Bulk save ────────────────────────────────────────────────────────────
  const handleBulkSaveAssignment = useCallback(
    (empId: string, operations: BulkEditOperation[]): void => {
      if (operations.length === 0) return;

      const employee = enrichedGanttData.find((e) => e.empId === empId || e._realEmpId === empId);
      const resolvedEmpId = employee?._realEmpId || empId;
      const nameParts = employee ? employee.name.split(" ") : ["", ""];
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // ── Scenario mode ──
      if (activeScenarioId) {
        for (const op of operations) {
          const opData = op.data || {};
          const jobNo = opData.jobNo || "";
          const startDate = opData.startDate || "";
          const util = opData.utilization ?? 100;
          const key = assignmentKey(resolvedEmpId, jobNo, toDateString(startDate));

          if (op.type === "delete") {
            const origKey = op.originalKey || key;
            upsertOverride(origKey, {
              type: "delete",
              data: { empId: resolvedEmpId, jobNo, startDate: toDateString(startDate) },
            });
          } else if (op.type === "edit") {
            const origKey = op.originalKey || key;
            if (origKey !== key) {
              // Key changed (jobNo or startDate modified) → delete old + create new
              upsertOverride(origKey, {
                type: "delete",
                data: {
                  empId: resolvedEmpId,
                  jobNo: op.originalJobNo || jobNo,
                  startDate: op.originalStartDate || toDateString(startDate),
                },
              });
              upsertOverride(key, {
                type: "create",
                data: { empId: resolvedEmpId, firstName, lastName, ...opData, jobNo, startDate, utilization: util },
              });
            } else {
              upsertOverride(key, {
                type: "edit",
                data: { empId: resolvedEmpId, ...opData, jobNo, startDate, utilization: util },
              });
            }
          } else if (op.type === "create") {
            upsertOverride(key, {
              type: "create",
              data: { empId: resolvedEmpId, firstName, lastName, ...opData, jobNo, startDate, utilization: util },
            });
          }
        }
        return;
      }

      // ── Real data mode ──
      // Arrays are reset at the start of the updater to handle React Strict Mode
      // double-invocation (dev mode calls functional updaters twice; side effects
      // would otherwise duplicate history entries).
      const historyBefore: StaffingRecord[] = [];
      const historyAfter: StaffingRecord[] = [];

      setData((prev) => {
        // Reset to handle React Strict Mode double-invocation
        historyBefore.length = 0;
        historyAfter.length = 0;
        let next = [...prev];

        for (const op of operations) {
          const opData = op.data || {};
          const jobNo = opData.jobNo || "";
          const startDate = opData.startDate || "";
          const endDate = opData.endDate || "";
          const util = opData.utilization ?? 0;

          if (op.type === "delete") {
            // Match by empId + jobNo + startDate, and optionally endDate for precision
            const idx = findByUid(next, opData._uid, resolvedEmpId, jobNo, startDate, endDate || undefined);
            if (idx !== -1) {
              historyBefore.push({ ...next[idx] });
              next.splice(idx, 1);
            }
          } else if (op.type === "edit") {
            const idx = findByUid(
              next,
              opData._uid,
              resolvedEmpId,
              op.originalJobNo || jobNo,
              op.originalStartDate || startDate
            );
            if (idx !== -1) {
              historyBefore.push({ ...next[idx] });
              next[idx] = {
                ...next[idx],
                ...opData,
                empId: resolvedEmpId,
                startDateParsed: startDate,
                endDateParsed: endDate,
                utilization: util || next[idx].utilization,
                hoursPerDay: ((util || next[idx].utilization) / 100) * getHoursPerDay(employee?.grade),
                isModified: true,
              } as StaffingRecord;
              historyAfter.push({ ...next[idx] });
            }
          } else if (op.type === "create") {
            const newRecord = buildNewRecord({ ...opData, empId: resolvedEmpId, utilization: util || 100 }, employee);
            next.push(newRecord);
            historyAfter.push({ ...newRecord });
          }
        }

        return next;
      });

      setChangeHistory((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: "bulk_edit",
          timestamp: new Date(),
          scenarioId: activeScenarioId || null,
          employeeName: employee?.name || resolvedEmpId,
          employeeId: resolvedEmpId,
          before: historyBefore,
          after: historyAfter,
          _operationCount: operations.length,
        },
      ]);

      // Persist edits to backend event log
    },
    [enrichedGanttData, setData, activeScenarioId, upsertOverride, buildNewRecord]
  );

  // ── History: revert ────────────────────────────────────────────────────────
  // Generic pattern: remove "after" records, restore "before" records.
  // category_toggle is special: removes ALL records for empId+jobNo since
  // date-scoped splits create records not captured in "after".
  const handleRevertChange = useCallback(
    (historyEntry: ChangeHistoryEntry): void => {
      if (historyEntry.type === "category_toggle") {
        if (historyEntry.before && Array.isArray(historyEntry.before)) {
          setData((prev) => {
            const next = prev.filter((r) => !(r.empId === historyEntry.employeeId && r.jobNo === historyEntry._jobNo));
            const beforeArr = Array.isArray(historyEntry.before) ? historyEntry.before : [];
            return [...next, ...beforeArr.map((b) => ({ ...b }))];
          });
        } else if (historyEntry._jobNo && historyEntry._oldCategory) {
          setData((prev) =>
            prev.map((r) => {
              if (r.empId === historyEntry.employeeId && r.jobNo === historyEntry._jobNo) {
                return { ...r, category: historyEntry._oldCategory!, isModified: false };
              }
              return r;
            })
          );
        }
      } else {
        // Unified revert: normalize before/after to arrays, then remove after + restore before
        const before: StaffingRecord[] =
          historyEntry.before == null
            ? []
            : Array.isArray(historyEntry.before)
              ? historyEntry.before
              : [historyEntry.before];
        const after: StaffingRecord[] =
          historyEntry.after == null
            ? []
            : Array.isArray(historyEntry.after)
              ? historyEntry.after
              : [historyEntry.after];
        setData((prev) => {
          let next =
            after.length > 0
              ? prev.filter(
                  (r) =>
                    !after.some(
                      (a) =>
                        r.empId === a.empId &&
                        r.jobNo === a.jobNo &&
                        toDateString(r.startDate) === toDateString(a.startDate)
                    )
                )
              : [...prev];
          if (before.length > 0) next = [...next, ...before.map((b) => ({ ...b }))];
          return next;
        });
      }
      setChangeHistory((prev) => prev.filter((entry) => entry.id !== historyEntry.id));
    },
    [setData, data]
  );

  return {
    changeHistory,
    handleDeleteAssignment,
    handleRevertAssignment,
    handleBulkSaveAssignment,
    handleToggleCategory,
    handleDragEnd,
  };
};
