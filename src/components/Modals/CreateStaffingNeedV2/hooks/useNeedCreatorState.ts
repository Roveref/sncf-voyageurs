/**
 * useNeedCreatorState — Central local state hook for the V2 staffing need creation modal.
 * Owns form state, staged needs, validation, and save logic.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useUserDataStore } from "../../../../stores/useUserDataStore";
import { useComputedStore } from "../../../../stores/useComputedStore";
import { formatLocalDate, addMonths } from "../../../StaffingTab/utils/dateUtils";
import {
  getValidGrades,
  generateId,
  computeWorkingDays,
  nextMonday,
  firstOfNextMonth,
  endOfQuarter,
} from "../../staffingNeedUtils";
import type { NeedFormState, StagedNeed } from "../types";
import { emptyFormState } from "../types";

export function useNeedCreatorState(
  opportunityData: Record<string, any>[],
  initialOpportunity: Record<string, any> | null | undefined,
  open: boolean,
  onClose: () => void
) {
  // ── Selection state ──
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Record<string, any> | null>(null);

  // ── Form state ──
  const [form, setForm] = useState<NeedFormState>(emptyFormState());
  const [stagedNeeds, setStagedNeeds] = useState<StagedNeed[]>([]);
  const [editingNeedId, setEditingNeedId] = useState<string | null>(null);
  // Track whether we're editing a staged need or an existing persisted need
  const [editingExistingNeedId, setEditingExistingNeedId] = useState<string | null>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const flashTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Store access ──
  const manualAccounts = useUserDataStore((s) => s.manualAccounts);
  const staffingEmployees = useComputedStore((s) => s.staffingEmployees);

  // ── Pre-fill from initialOpportunity ──
  useEffect(() => {
    if (open && initialOpportunity) {
      const account = initialOpportunity.account?.trim() || null;
      setSelectedAccount(account);
      const match = opportunityData.find((o) => o.opportunityId === initialOpportunity.opportunityId);
      const opp = match || initialOpportunity;
      setSelectedOpportunity({
        ...opp,
        label: opp.opportunity || opp.opportunityId,
        account: opp.account || "",
      });
    }
  }, [open, initialOpportunity, opportunityData]);

  // ── Derived ──
  const accountList = useMemo(() => {
    const set = new Set<string>();
    opportunityData.forEach((o) => {
      if (o.account?.trim()) set.add(o.account.trim());
    });
    manualAccounts.forEach((a: any) => set.add(a.account));
    return [...set].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }, [opportunityData, manualAccounts]);

  const filteredOpportunities = useMemo(() => {
    const opps = selectedAccount ? opportunityData.filter((o) => o.account === selectedAccount) : opportunityData;
    return opps.map((o) => ({ ...o, label: `${o.opportunity || o.opportunityId}`, account: o.account || "" }));
  }, [opportunityData, selectedAccount]);

  const employeeOptions = useMemo(() => {
    if (!staffingEmployees?.length) return [];
    const seen = new Set<string>();
    return staffingEmployees
      .filter((e: any) => {
        if (!e.empId || seen.has(e.empId)) return false;
        seen.add(e.empId);
        return true;
      })
      .map((e: any) => ({ empId: e.empId, name: e.name || e.empId, grade: e.grade || "" }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }, [staffingEmployees]);

  const sortedEmployeeOptions = useMemo(() => {
    if (!form.grade) return employeeOptions;
    // Sort so all same-grade employees come first (contiguous group for MUI groupBy)
    return [...employeeOptions].sort((a, b) => {
      const aMatch = a.grade === form.grade ? 0 : 1;
      const bMatch = b.grade === form.grade ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
    });
  }, [employeeOptions, form.grade]);

  // ── Validation ──
  const dateError = !!(form.startDate && form.endDate && form.endDate < form.startDate);
  const formDatesValid = !!form.startDate && !!form.endDate && !dateError;
  const canAdd = !!selectedOpportunity && !!form.grade && formDatesValid;
  const canSave = !!selectedOpportunity && stagedNeeds.length > 0;

  const workingDays = useMemo(() => computeWorkingDays(form.startDate, form.endDate), [form.startDate, form.endDate]);

  // ── Flash helper ──
  const triggerFlash = useCallback((id: string) => {
    setLastAddedId(id);
    clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setLastAddedId(null), 800);
  }, []);

  // ── Form update helpers ──
  const updateForm = useCallback((patch: Partial<NeedFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    // Clear errors for updated fields
    setFormErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }, []);

  const setStartDate = useCallback(
    (d: Date) => {
      updateForm({ startDate: formatLocalDate(d) });
    },
    [updateForm]
  );

  const setEndDate = useCallback(
    (d: Date) => {
      updateForm({ endDate: formatLocalDate(d) });
    },
    [updateForm]
  );

  const refDate = form.startDate || formatLocalDate(new Date());

  const quickStartDates = useMemo(
    () =>
      [
        { label: "Today", fn: () => new Date() },
        { label: "W+1", fn: nextMonday },
        { label: "M+1", fn: firstOfNextMonth },
      ] as const,
    []
  );

  const quickEndDates = useMemo(
    () =>
      [
        { label: "+1M", fn: () => addMonths(new Date((form.startDate || refDate) + "T00:00:00"), 1) },
        { label: "+3M", fn: () => addMonths(new Date((form.startDate || refDate) + "T00:00:00"), 3) },
        { label: "+9M", fn: () => addMonths(new Date((form.startDate || refDate) + "T00:00:00"), 9) },
      ] as const,
    [form.startDate, refDate]
  );

  const isEditing = !!editingNeedId || !!editingExistingNeedId;

  // ── Add / update need ──
  const addNeed = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!form.grade) errors.grade = "Grade is required";
    if (!form.startDate) errors.startDate = "Start date is required";
    if (!form.endDate) errors.endDate = "End date is required";
    if (form.startDate && form.endDate && form.endDate < form.startDate) errors.endDate = "End must be after start";
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    if (!getValidGrades().includes(form.grade)) return;

    if (editingExistingNeedId && selectedOpportunity) {
      // Update an existing persisted need in store
      const opportunityId = selectedOpportunity.opportunityId;
      const ds = useUserDataStore.getState();
      const current = ds.staffingNeeds[opportunityId] || [];
      ds.setStaffingNeeds(
        opportunityId,
        current.map((n: any) =>
          n.id === editingExistingNeedId
            ? {
                ...n,
                grade: form.grade,
                startDate: form.startDate,
                endDate: form.endDate,
                utilization: form.utilization,
                probability: form.probability / 100,
                quantity: form.quantity,
                skills: [...form.skills],
                assignedTo: form.preferredPerson || undefined,
                description: form.description || undefined,
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      );
      setEditingExistingNeedId(null);
    } else if (editingNeedId) {
      // Update staged need
      setStagedNeeds((prev) => prev.map((n) => (n.id === editingNeedId ? { ...n, ...form } : n)));
      triggerFlash(editingNeedId);
      setEditingNeedId(null);
    } else {
      // Add new staged need
      const id = generateId();
      const need: StagedNeed = { id, ...form };
      setStagedNeeds((prev) => [...prev, need]);
      triggerFlash(id);
    }
    // Reset form but keep grade + dates for rapid multi-add
    setForm((prev) => ({
      ...prev,
      skills: [],
      preferredPerson: "",
      description: "",
      quantity: 1,
    }));
  }, [form, editingNeedId, editingExistingNeedId, selectedOpportunity, triggerFlash]);

  // ── Remove staged need ──
  const removeNeed = useCallback(
    (id: string) => {
      setStagedNeeds((prev) => prev.filter((n) => n.id !== id));
      if (editingNeedId === id) {
        setEditingNeedId(null);
        setForm(emptyFormState());
      }
    },
    [editingNeedId]
  );

  // ── Edit staged need ──
  const editNeed = useCallback(
    (need: StagedNeed) => {
      if (editingNeedId === need.id) {
        setEditingNeedId(null);
        setForm(emptyFormState());
      } else {
        setEditingNeedId(need.id);
        setForm({
          grade: need.grade,
          startDate: need.startDate,
          endDate: need.endDate,
          utilization: need.utilization,
          probability: need.probability,
          quantity: need.quantity,
          skills: [...need.skills],
          preferredPerson: need.preferredPerson,
          description: need.description,
        });
      }
    },
    [editingNeedId]
  );

  // ── Edit existing persisted need (load into form) ──
  const editExistingNeed = useCallback(
    (need: any) => {
      if (editingExistingNeedId === need.id) {
        setEditingExistingNeedId(null);
        setEditingNeedId(null);
        setForm(emptyFormState());
      } else {
        setEditingExistingNeedId(need.id);
        setEditingNeedId(null);
        setForm({
          grade: need.grade || "",
          startDate: need.startDate || "",
          endDate: need.endDate || "",
          utilization: need.utilization ?? 100,
          probability: Math.round((need.probability ?? 1) * 100),
          quantity: need.quantity || 1,
          skills: [...(need.skills || [])],
          preferredPerson: need.assignedTo || "",
          description: need.description || "",
        });
      }
    },
    [editingExistingNeedId]
  );

  // ── Reset form ──
  const resetForm = useCallback(() => {
    setForm(emptyFormState());
    setEditingNeedId(null);
    setEditingExistingNeedId(null);
    setFormErrors({});
  }, []);

  // ── Delete existing need (already persisted) ──
  const deleteExistingNeed = useCallback(
    (needId: string) => {
      if (!selectedOpportunity) return;
      const opportunityId = selectedOpportunity.opportunityId;
      const ds = useUserDataStore.getState();
      const current = ds.staffingNeeds[opportunityId] || [];
      ds.setStaffingNeeds(
        opportunityId,
        current.filter((n: any) => n.id !== needId)
      );
    },
    [selectedOpportunity]
  );

  // ── Save all staged needs to store ──
  const handleSave = useCallback(() => {
    if (!selectedOpportunity || !stagedNeeds.length) return;
    const opportunityId = selectedOpportunity.opportunityId;
    const now = new Date().toISOString();
    const newNeeds = stagedNeeds.flatMap((n) => {
      const base = {
        opportunityId,
        grade: n.grade,
        startDate: n.startDate,
        endDate: n.endDate,
        skills: [...n.skills],
        utilization: n.utilization,
        probability: n.probability / 100,
        assignedTo: n.preferredPerson || undefined,
        description: n.description || undefined,
        status: "open" as const,
        createdAt: now,
        updatedAt: now,
      };
      // Expand quantity into individual needs
      return Array.from({ length: n.quantity }, () => ({
        ...base,
        id: generateId(),
        quantity: 1,
      }));
    });
    const ds = useUserDataStore.getState();
    ds.setStaffingNeeds(opportunityId, [...(ds.staffingNeeds[opportunityId] || []), ...newNeeds]);
    handleClose();
  }, [selectedOpportunity, stagedNeeds]);

  // ── Close and reset everything ──
  const handleClose = useCallback(() => {
    setSelectedAccount(null);
    setSelectedOpportunity(null);
    setStagedNeeds([]);
    setForm(emptyFormState());
    setEditingNeedId(null);
    setEditingExistingNeedId(null);
    setLastAddedId(null);
    setFormErrors({});
    onClose();
  }, [onClose]);

  return {
    // Selection
    selectedAccount,
    setSelectedAccount,
    selectedOpportunity,
    setSelectedOpportunity,
    accountList,
    filteredOpportunities,
    // Form
    form,
    updateForm,
    setStartDate,
    setEndDate,
    quickStartDates,
    quickEndDates,
    formErrors,
    dateError,
    formDatesValid,
    canAdd,
    workingDays,
    // Employees
    sortedEmployeeOptions,
    // Needs
    stagedNeeds,
    editingNeedId,
    editingExistingNeedId,
    isEditing,
    lastAddedId,
    addNeed,
    removeNeed,
    editNeed,
    editExistingNeed,
    resetForm,
    deleteExistingNeed,
    // Save
    canSave,
    handleSave,
    handleClose,
  };
}
