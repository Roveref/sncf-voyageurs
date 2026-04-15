/**
 * Cross-store coordination helpers.
 *
 * These functions coordinate operations that span multiple Zustand stores,
 * ensuring data integrity without coupling stores to each other.
 */

import { useAppStore } from "./useAppStore";
import { useThemeStore } from "./useThemeStore";
import { useLoadingStore } from "./useLoadingStore";
import { useUserDataStore } from "./useUserDataStore";
import { useComputedStore } from "./useComputedStore";
import { useUIStore } from "./useUIStore";
import useScenarioStore from "./useScenarioStore";
import { useFilterStore } from "./useFilterStore";
import { useWidgetRegistry } from "./useWidgetRegistry";
import { useDashboardLayoutStore } from "./useDashboardLayoutStore";
import { initializeFilters } from "../utils/filterHelpers";

/**
 * Delete a scenario and clean up related state.
 * Replaces the manual pattern where callers must remember to clear editorStates.
 */
export function deleteScenarioWithCleanup(scenarioId: string): void {
  const wasActive = scenarioId === useScenarioStore.getState().activeScenarioId;
  useScenarioStore.getState().deleteScenario(scenarioId);
  if (wasActive) {
    useUserDataStore.getState().setEditorStates({});
  }
}

/**
 * Reset all stores to initial state. Call on logout.
 */
export function resetAllStores(): void {
  // Loading & UI
  useLoadingStore.setState({
    loading: false,
    loadingProgress: 0,
    loadingMessage: "",
    syncStatus: "idle",
    lastSavedAt: null,
    notification: { open: false, message: "", severity: "info" },
  });

  useAppStore.setState({
    hydrationFilter: null,
    sinceYear: 2022,
    filteredOppIds: new Set(),
    notifFilteredOppIds: new Set(),
    liveChangedOppIds: new Set(),
    liveRevenueDelta: 0,
    liveFilterActive: false,
    showNetRevenue: true,
    showIO: "off",
    showLost: false,
    modificationsEnabled: "all",
    sseNotificationVersion: 0,
  });

  useUIStore.setState({
    createModalOpen: false,
    createAccountModalOpen: false,
    createStaffingNeedModalOpen: false,
    staffingNeedOpportunity: null,
    staffingNeedsDrawerOpen: false,
    bulkEditPrefill: null,
    pendingStaffingFilter: null,
    fabOpen: false,
    editOpportunity: null,
    navigateToOpportunityId: null,
    selectedOpportunities: [],
    staffingDebugToggleVersion: 0,
    lastAiAction: null,
  });

  // Data stores
  useUserDataStore.setState({
    statusOverrides: {},
    manualOpportunities: [],
    manualAccounts: [],
    opportunityActions: {},
    staffingNeeds: {},
    revenueTeam: {},
    employeeOverrides: {},
    manualEmployees: [],
    editorStates: {},
  });

  useComputedStore.setState({
    staffingEmployees: [],
    dailyGrid: null,
    timelineCalendar: null,
    calendarIndex: null,
    skillsCatalog: [],
    staffingIndexVersion: 0,
  });

  // useCrmStore removed — CRM data lives in React Query cache (cleared via queryClient.clear())
  // useRecruitmentStore removed — data lives in React Query cache

  useScenarioStore.setState({ scenarios: [], activeScenarioId: null });
  useFilterStore.setState({ filters: initializeFilters(), segmentModes: new Map(), serviceLineModes: new Map() });
  useWidgetRegistry.setState({ widgets: new Map() });
  // Note: useThemeStore and useDashboardLayoutStore persist to localStorage — not reset on logout
}
