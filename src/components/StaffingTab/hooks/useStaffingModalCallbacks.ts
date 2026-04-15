import { useCallback, useMemo } from "react";
import { useUserDataStore } from "../../../stores/useUserDataStore";
import { getRealEmpId } from "../utils/empIdUtils";
import type { Employee } from "../types";

interface UseStaffingModalCallbacksArgs {
  // Setters from useStaffingModals
  setShowAlertsPanel: (v: boolean) => void;
  setShowPlanningModal: (v: boolean) => void;
  setShowCalendarModal: (v: boolean) => void;
  setSelectedEmployee: (v: Employee | null) => void;
  setWaterfallModalData: (v: any) => void;
  setProfileModalOpen: (v: boolean) => void;
  setProfileModalEmployee: (v: Employee | null) => void;
  setPeriodDetailModal: (v: any) => void;
  setScenarioCreateOpen: (v: boolean) => void;
  setScenarioCompareOpen: (v: boolean) => void;
  setOpportunityModalRow: (v: any) => void;
  // Data for derived employee modal values
  profileModalEmployee: Employee | null;
  effectiveMetadata: Record<string, any>;
  sapEnrichment: any;
  employeeStructures: Employee[];
  // Timeline data for employee counts
  timelineStart: Date | null;
  timelineEnd: Date | null;
}

/**
 * Stable close-callback refs for StaffingModals + derived employee modal memos
 * + employee count helpers (displayed / total / filtered).
 */
export function useStaffingModalCallbacks({
  setShowAlertsPanel,
  setShowPlanningModal,
  setShowCalendarModal,
  setSelectedEmployee,
  setWaterfallModalData,
  setProfileModalOpen,
  setProfileModalEmployee,
  setPeriodDetailModal,
  setScenarioCreateOpen,
  setScenarioCompareOpen,
  setOpportunityModalRow,
  profileModalEmployee,
  effectiveMetadata,
  sapEnrichment,
  employeeStructures,
  timelineStart,
  timelineEnd,
}: UseStaffingModalCallbacksArgs) {
  // ── Modal close callbacks ────────────────────────────────────────────────
  const handleCloseAlerts = useCallback(() => setShowAlertsPanel(false), [setShowAlertsPanel]);
  const handleClosePlanning = useCallback(() => {
    setShowPlanningModal(false);
    setSelectedEmployee(null);
  }, [setShowPlanningModal, setSelectedEmployee]);
  const handleCloseCalendar = useCallback(() => {
    setShowCalendarModal(false);
    setSelectedEmployee(null);
  }, [setShowCalendarModal, setSelectedEmployee]);
  const handleCloseWaterfall = useCallback(() => setWaterfallModalData(null), [setWaterfallModalData]);
  const handleCloseProfile = useCallback(() => {
    setProfileModalOpen(false);
    setProfileModalEmployee(null);
  }, [setProfileModalOpen, setProfileModalEmployee]);
  const handleClosePeriodDetail = useCallback(() => setPeriodDetailModal(null), [setPeriodDetailModal]);
  const handleCloseScenarioCreate = useCallback(() => setScenarioCreateOpen(false), [setScenarioCreateOpen]);
  const handleCloseScenarioCompare = useCallback(() => setScenarioCompareOpen(false), [setScenarioCompareOpen]);
  const handleCloseOpportunityModal = useCallback(() => setOpportunityModalRow(null), [setOpportunityModalRow]);

  // ── Derived employee modal memos ─────────────────────────────────────────
  const manualEmployeesFromStore = useUserDataStore((s) => s.manualEmployees);

  const isManualEmployee = useMemo(
    () =>
      manualEmployeesFromStore.some(
        (m) => m.empId === (profileModalEmployee ? getRealEmpId(profileModalEmployee) : undefined)
      ),
    [manualEmployeesFromStore, profileModalEmployee]
  );

  const profileExistingMetadata = useMemo(
    () => (profileModalEmployee ? effectiveMetadata[getRealEmpId(profileModalEmployee)] : undefined),
    [profileModalEmployee, effectiveMetadata]
  );

  const profileSapGradeHistory = useMemo(
    () =>
      (profileModalEmployee && sapEnrichment?.gradeResults[getRealEmpId(profileModalEmployee)]?.gradeHistory) ||
      undefined,
    [profileModalEmployee, sapEnrichment]
  );

  const profileEmployeeNames = useMemo(
    () => [...new Set(employeeStructures.map((e) => e.name).filter(Boolean))].sort(),
    [employeeStructures]
  );

  // ── Employee count helper (shared, replaces 3 inline IIFEs) ─────────────
  const countUniqueInTimeline = useCallback(
    (employees: Employee[]) => {
      const pStart = timelineStart ? new Date(timelineStart).toISOString().slice(0, 10) : null;
      const pEnd = timelineEnd ? new Date(timelineEnd).toISOString().slice(0, 10) : null;
      const ids = new Set<string>();
      employees.forEach((e) => {
        const rid = getRealEmpId(e);
        const ok =
          !e._isGradeSplit ||
          ((!e._arrivalDate || !pEnd || e._arrivalDate < pEnd) &&
            (!e._departureDate || !pStart || e._departureDate >= pStart));
        if (ok) ids.add(rid);
      });
      return ids.size;
    },
    [timelineStart, timelineEnd]
  );

  return {
    handleCloseAlerts,
    handleClosePlanning,
    handleCloseCalendar,
    handleCloseWaterfall,
    handleCloseProfile,
    handleClosePeriodDetail,
    handleCloseScenarioCreate,
    handleCloseScenarioCompare,
    handleCloseOpportunityModal,
    isManualEmployee,
    profileExistingMetadata,
    profileSapGradeHistory,
    profileEmployeeNames,
    countUniqueInTimeline,
  };
}
