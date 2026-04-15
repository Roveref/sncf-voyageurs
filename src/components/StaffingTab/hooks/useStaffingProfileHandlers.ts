import React, { useCallback, startTransition } from "react";
import { getHoursPerDay } from "../constants";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import type { EmployeeMetadata, Employee, StaffingFilters, WaterfallStep } from "../types";

/** Waterfall modal data shape */
interface WaterfallModalData {
  title: string;
  steps: WaterfallStep[];
  grossH: number;
  tu: number;
}

interface UseStaffingEmployeeHandlersParams {
  setFilters: React.Dispatch<React.SetStateAction<StaffingFilters>>;
  setShowAlertsPanel: (val: boolean) => void;
  setShowUtilization: React.Dispatch<React.SetStateAction<boolean>>;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedEmployee: (val: Employee | null) => void;
  setShowPlanningModal: (val: boolean) => void;
  setShowCalendarModal: (val: boolean) => void;
  setProfileModalEmployee: (val: Employee | null) => void;
  setProfileModalOpen: (val: boolean) => void;
  setWaterfallModalData: (val: WaterfallModalData | null) => void;
  setGranularity: (val: string) => void;
  setEmployeeLevel: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  resetTimeline: () => void;
}

export function useStaffingEmployeeHandlers({
  setFilters,
  setShowAlertsPanel,
  setShowUtilization,
  setCollapsedGroups,
  setSelectedEmployee,
  setShowPlanningModal,
  setShowCalendarModal,
  setProfileModalEmployee,
  setProfileModalOpen,
  setWaterfallModalData,
  setGranularity,
  setEmployeeLevel,
  resetTimeline,
}: UseStaffingEmployeeHandlersParams) {
  // ── Employee handlers ───────────────────────────────────────────────────
  const handleEmployeeNameClick = useCallback((employee: Employee) => {
    setProfileModalEmployee(employee);
    setProfileModalOpen(true);
  }, []);

  const handleShowWaterfall = useCallback((employee: Employee) => {
    const empHPD = getHoursPerDay(employee.grade);
    const gross = ((employee.totalWorkingDaysInPeriod || 0) + (employee.totalHolidayDaysInPeriod || 0)) * empHPD;
    const abs = employee.totalAbsenceHoursInPeriod || 0;
    const hol = (employee.totalHolidayDaysInPeriod || 0) * empHPD;
    const chAll = employee.totalChargeableHoursInPeriod || 0;
    const chOnly = employee.totalChargeableOnlyHoursInPeriod || 0;
    const go = Math.max(0, chAll - chOnly);
    const tr = employee.totalTrainingHoursInPeriod || 0;

    if (gross <= 0) return;

    const steps: WaterfallStep[] = [];
    let running = gross;
    steps.push({ label: "Total", value: gross, offset: 0, type: "result", color: "#d1d5db" });
    if (abs > 0) {
      running -= abs;
      steps.push({ label: "- Absences", value: abs, offset: running, type: "sub", color: "#fb7185", tc: "#fb7185" });
    }
    if (hol > 0) {
      running -= hol;
      steps.push({ label: "- Holidays", value: hol, offset: running, type: "sub", color: "#fca5a5", tc: "#fca5a5" });
    }
    steps.push({ label: "= Net", value: running, offset: 0, type: "result", color: "#d1d5db" });
    if (chOnly > 0) {
      running -= chOnly;
      steps.push({ label: "- Billable", value: chOnly, offset: running, type: "sub", color: "#60a5fa", tc: "#60a5fa" });
    }
    if (go > 0) {
      running -= go;
      steps.push({
        label: "- Gen. Oppty",
        value: go,
        offset: running,
        type: "sub",
        color: "#22d3ee",
        tc: "#22d3ee",
      });
    }
    if (tr > 0) {
      running -= tr;
      steps.push({ label: "- Training", value: tr, offset: running, type: "sub", color: "#34d399", tc: "#34d399" });
    }
    steps.push({
      label: "= Avail",
      value: Math.max(0, running),
      offset: 0,
      type: "result",
      color: "#34d399",
      tc: "#34d399",
    });

    const net = gross - abs - hol;
    const tu = net > 0 ? (chOnly / net) * 100 : 0;

    setWaterfallModalData({ title: employee.name, steps, grossH: gross, tu });
  }, []);

  const handleSaveEmployee = useCallback((empId: string, metadata: EmployeeMetadata) => {
    useUserDataStore.getState().upsertOverride(empId, metadata);
    // If this is a new employee (has name in metadata), store in manual employees
    if (metadata.name) {
      useUserDataStore.getState().addManualEmployee({ empId, name: metadata.name });
    }
  }, []);

  const handleDeleteEmployee = useCallback((empId: string) => {
    useUserDataStore.getState().removeManualEmployee(empId);
    useUserDataStore.getState().deleteOverride(empId);
  }, []);

  // ── View / navigation handlers ───────────────────────────────────────────
  const handleResetView = useCallback(() => {
    resetTimeline();
    setGranularity("halfmonth");
  }, [resetTimeline]);

  const handleSearchChange = useCallback((val: string) => setFilters((prev) => ({ ...prev, search: val })), []);

  const handleAutoSortToggle = useCallback(() => setFilters((prev) => ({ ...prev, autoSort: !prev.autoSort })), []);

  const handleToggleEmployee = useCallback((empId: string) => {
    // startTransition: expanding triggers heavy per-day computations in EmployeeRow
    // (liveDailyCells, hoursInfo, UtilizationChart). Deferring keeps the UI responsive.
    startTransition(() => {
      setEmployeeLevel((prev: Map<string, number>) => {
        const m = new Map(prev);
        const cur = m.get(empId) || 0;
        if (cur === 0)
          m.set(empId, 2); // 0 -> 2 (open level 1+2 together)
        else m.delete(empId); // 1 or 2 -> 0 (close)
        return m;
      });
    });
  }, []);

  const handleToggleUtilization = useCallback(() => setShowUtilization((p: boolean) => !p), []);

  const handleToggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const handleNavigateToEmployee = useCallback((empId: string) => {
    setFilters((prev) => ({ ...prev, search: empId }));
    setShowAlertsPanel(false);
    setEmployeeLevel(new Map([[empId, 2]]));
  }, []);

  const handleViewPlanning = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setShowPlanningModal(true);
  }, []);

  const handleViewCalendar = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setShowCalendarModal(true);
  }, []);

  return {
    handleEmployeeNameClick,
    handleShowWaterfall,
    handleSaveEmployee,
    handleDeleteEmployee,
    handleResetView,
    handleSearchChange,
    handleAutoSortToggle,
    handleToggleEmployee,
    handleToggleUtilization,
    handleToggleGroup,
    handleNavigateToEmployee,
    handleViewPlanning,
    handleViewCalendar,
  };
}
