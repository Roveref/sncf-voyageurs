/**
 * Integration tests: Full data lifecycle across stores.
 *
 * Covers: resetAllStores(), logout cycle, deleteScenarioWithCleanup(),
 * STATUS_OPTIONS reactivity, and cross-store manual opportunity lifecycle.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resetAllStores, deleteScenarioWithCleanup } from "../helpers";
import { useAppStore } from "../useAppStore";
import { useThemeStore } from "../useThemeStore";
import { useLoadingStore } from "../useLoadingStore";
import { useUserDataStore } from "../useUserDataStore";
import { useComputedStore } from "../useComputedStore";
import { useUIStore } from "../useUIStore";
import useScenarioStore from "../useScenarioStore";
import { useFilterStore } from "../useFilterStore";
import { STATUS_OPTIONS, updateStatusOptionsFromOptionSet } from "../../utils/statusOptions";
import { useWidgetRegistry } from "../useWidgetRegistry";
import { useDashboardLayoutStore } from "../useDashboardLayoutStore";
import { useAuthStore } from "../useAuthStore";
import { initializeFilters } from "../../utils/filterHelpers";

// ── Helpers ──

const makeOpp = (id: string, account: string) =>
  ({
    opportunityId: id,
    account: account,
    opportunity: `Opp ${id}`,
    grossRevenue: 100000,
    status: 6,
  }) as any;

/** Populate every store with non-default data to validate resetAllStores thoroughness. */
function populateAllStores() {
  // AppStore
  useAppStore.setState({
    hydrationFilter: { region: "EMEA", country: "France" },
    sinceYear: 2020,
    filteredOppIds: new Set(["OPP-1", "OPP-2"]),
    liveChangedOppIds: new Set(["OPP-3"]),
    liveRevenueDelta: 50000,
    liveFilterActive: true,
    showNetRevenue: false,
    showIO: "ioOnly",
    showLost: true,
    modificationsEnabled: "changes",
    sseNotificationVersion: 5,
  });

  // LoadingStore
  useLoadingStore.setState({
    loading: true,
    loadingProgress: 75,
    loadingMessage: "Loading staffing data...",
    syncStatus: "saving",
    lastSavedAt: Date.now(),
    notification: { open: true, message: "Test notification", severity: "warning" },
  });

  // UIStore
  useUIStore.setState({
    createModalOpen: true,
    createAccountModalOpen: true,
    createStaffingNeedModalOpen: true,
    staffingNeedsDrawerOpen: true,
    fabOpen: true,
    selectedOpportunities: [{ opportunityId: "OPP-UI" } as any],
    staffingDebugToggleVersion: 3,
    lastAiAction: { action: "test" },
  });

  // ComputedStore
  useComputedStore.setState({
    staffingEmployees: [{ empId: "EMP1", name: "John" } as any],
    skillsCatalog: [{ name: "React", category: "Frontend", usageCount: 10 }],
    staffingIndexVersion: 3,
  });

  // CrmStore removed — CRM data now lives in React Query cache

  // UserDataStore
  const userStore = useUserDataStore.getState();
  userStore.setEditorStates({
    EMP1: { baseline: [], actionLog: [], redoStack: [], current: [{ _uid: "seg1" } as any] },
  });
  userStore.addManualAccount({ account: "TestCorp" });
  userStore.addManualOpportunity(makeOpp("OPP-M1", "TestCorp"));
  userStore.setStatusOverride("OPP-M1", 6, 14, "Won");
  userStore.setOpportunityActions("OPP-M1", [{ id: "a1", description: "Call" } as any]);
  userStore.setStaffingNeeds("OPP-M1", [{ id: "n1", grade: "Consultant" } as any]);
  userStore.setRevenueTeam("OPP-M1", [{ id: "r1", name: "Alice", gradeBucket: "M/SM", percentage: 100 }]);
  userStore.setOverrides({ EMP1: { team: "Alpha", dm: "MGR1" } as any });
  userStore.setManualEmployees([{ empId: "MANUAL-1", name: "New Hire" }]);

  // ScenarioStore
  useScenarioStore.getState().createScenario("Test Scenario");

  // RecruitmentStore removed — data now lives in React Query cache

  // FilterStore
  useFilterStore.setState({
    filters: {
      ...initializeFilters(),
      serviceLine1: { included: ["Technology"], excluded: [] },
      accounts: { included: ["Acme"], excluded: [] },
    },
    segmentModes: new Map([["AMD", "team"]]),
    serviceLineModes: new Map([["Technology", "both"]]),
  });

  // WidgetRegistry
  useWidgetRegistry.getState().register("test-widget", "Test Widget", "group", () => null);
}

// Default label values — reset STATUS_OPTIONS between tests to avoid inter-test leakage.
const DEFAULT_LABELS: Record<number, string> = {
  1: "Lead Identified",
  4: "Go Approved",
  6: "Proposal Submitted",
  11: "Client Won",
  13: "AEL",
  14: "Booked",
  15: "Lost",
};

describe("Lifecycle Integration", () => {
  beforeEach(() => {
    resetAllStores();
    useScenarioStore.setState({ scenarios: [], activeScenarioId: null });
    useAuthStore.setState({ token: null, user: null });
    // Reset the module-level STATUS_OPTIONS labels to defaults
    updateStatusOptionsFromOptionSet(DEFAULT_LABELS);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. resetAllStores() lifecycle
  // ════════════════════════════════════════════════════════════════════════════

  describe("resetAllStores() lifecycle", () => {
    it("resets ALL stores back to initial state", () => {
      populateAllStores();

      // Sanity checks — stores are populated
      expect(useAppStore.getState().showIO).toBe("ioOnly");
      expect(useLoadingStore.getState().loading).toBe(true);
      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(1);
      expect(useScenarioStore.getState().scenarios.length).toBeGreaterThan(0);
      expect(useUserDataStore.getState().manualEmployees).toHaveLength(1);
      expect(useWidgetRegistry.getState().widgets.size).toBe(1);

      // Act
      resetAllStores();

      // ── AppStore ──
      const app = useAppStore.getState();
      expect(app.hydrationFilter).toBeNull();
      expect(app.sinceYear).toBe(2022);
      expect(app.filteredOppIds.size).toBe(0);
      expect(app.liveChangedOppIds.size).toBe(0);
      expect(app.liveRevenueDelta).toBe(0);
      expect(app.liveFilterActive).toBe(false);
      expect(app.showNetRevenue).toBe(true);
      expect(app.showIO).toBe("off");
      expect(app.showLost).toBe(false);
      expect(app.modificationsEnabled).toBe("all");
      expect(app.sseNotificationVersion).toBe(0);

      // ── LoadingStore ──
      const loading = useLoadingStore.getState();
      expect(loading.loading).toBe(false);
      expect(loading.loadingProgress).toBe(0);
      expect(loading.loadingMessage).toBe("");
      expect(loading.syncStatus).toBe("idle");
      expect(loading.lastSavedAt).toBeNull();
      expect(loading.notification.open).toBe(false);

      // ── UIStore ──
      const ui = useUIStore.getState();
      expect(ui.createModalOpen).toBe(false);
      expect(ui.createAccountModalOpen).toBe(false);
      expect(ui.createStaffingNeedModalOpen).toBe(false);
      expect(ui.staffingNeedsDrawerOpen).toBe(false);
      expect(ui.fabOpen).toBe(false);
      expect(ui.selectedOpportunities).toHaveLength(0);
      expect(ui.staffingDebugToggleVersion).toBe(0);
      expect(ui.lastAiAction).toBeNull();

      // ── UserDataStore ──
      const ud = useUserDataStore.getState();
      expect(Object.keys(ud.editorStates)).toHaveLength(0);
      expect(ud.manualAccounts).toHaveLength(0);
      expect(ud.manualOpportunities).toHaveLength(0);
      expect(Object.keys(ud.statusOverrides)).toHaveLength(0);
      expect(Object.keys(ud.opportunityActions)).toHaveLength(0);
      expect(Object.keys(ud.staffingNeeds)).toHaveLength(0);
      expect(Object.keys(ud.revenueTeam)).toHaveLength(0);
      expect(Object.keys(ud.employeeOverrides)).toHaveLength(0);
      expect(ud.manualEmployees).toHaveLength(0);

      // ── ComputedStore ──
      const computed = useComputedStore.getState();
      expect(computed.staffingEmployees).toHaveLength(0);
      expect(computed.dailyGrid).toBeNull();
      expect(computed.timelineCalendar).toBeNull();
      expect(computed.calendarIndex).toBeNull();
      expect(computed.skillsCatalog).toHaveLength(0);
      expect(computed.staffingIndexVersion).toBe(0);

      // CrmStore removed — CRM data now lives in React Query cache

      // ── ScenarioStore ──
      const scenario = useScenarioStore.getState();
      expect(scenario.scenarios).toHaveLength(0);
      expect(scenario.activeScenarioId).toBeNull();

      // RecruitmentStore removed — data now lives in React Query cache

      // ── FilterStore ──
      const filter = useFilterStore.getState();
      const freshFilters = initializeFilters();
      expect(filter.filters.serviceLine1.included).toHaveLength(0);
      expect(filter.filters.accounts.included).toHaveLength(0);
      expect(filter.segmentModes.size).toBe(0);
      expect(filter.serviceLineModes.size).toBe(0);

      // ── WidgetRegistry ──
      expect(useWidgetRegistry.getState().widgets.size).toBe(0);
    });

    it("does NOT reset theme (darkMode persists in localStorage)", () => {
      // Set darkMode on before reset
      useThemeStore.setState({ darkMode: true });

      populateAllStores();
      resetAllStores();

      // Theme survives reset
      expect(useThemeStore.getState().darkMode).toBe(true);
    });

    it("does NOT reset dashboard layout (persists in localStorage)", () => {
      useDashboardLayoutStore.setState({
        widgets: [{ id: "w1", widgetKey: "tu-overview", col: 0, row: 0, colSpan: 2, rowSpan: 1 }],
      });

      populateAllStores();
      resetAllStores();

      // Dashboard layout survives reset
      expect(useDashboardLayoutStore.getState().widgets).toHaveLength(1);
      expect(useDashboardLayoutStore.getState().widgets[0].widgetKey).toBe("tu-overview");
    });

    it("does NOT reset statusOptions (config, not user data)", () => {
      // Update status labels before reset
      updateStatusOptionsFromOptionSet({ 1: "Custom Lead Label" });
      const beforeReset = STATUS_OPTIONS.find((o) => o.status === 1)!;
      expect(beforeReset.label).toBe("Custom Lead Label");

      resetAllStores();

      // statusOptions are module-level — not touched by resetAllStores
      expect(STATUS_OPTIONS).toHaveLength(7);
      expect(STATUS_OPTIONS.find((o) => o.status === 1)!.label).toBe("Custom Lead Label");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Logout cycle
  // ════════════════════════════════════════════════════════════════════════════

  describe("Logout cycle", () => {
    it("clears auth token and user on logout", () => {
      useAuthStore.getState().setAuth("jwt-token-123", { username: "admin", displayName: "Admin" });
      expect(useAuthStore.getState().token).toBe("jwt-token-123");
      expect(useAuthStore.getState().user).toEqual({ username: "admin", displayName: "Admin" });

      useAuthStore.getState().logout();

      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("resets all stores on logout (same as resetAllStores)", () => {
      // Set auth
      useAuthStore.getState().setAuth("jwt-token-123", { username: "admin", displayName: "Admin" });

      // Populate all stores with data
      populateAllStores();

      // Sanity check
      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(1);

      // Logout
      useAuthStore.getState().logout();

      // Verify auth cleared
      expect(useAuthStore.getState().token).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();

      // Verify all stores reset (same checks as resetAllStores)
      expect(useAppStore.getState().showIO).toBe("off");
      expect(useLoadingStore.getState().loading).toBe(false);
      expect(useComputedStore.getState().staffingEmployees).toHaveLength(0);
      expect(Object.keys(useUserDataStore.getState().editorStates)).toHaveLength(0);
      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(0);
      expect(useUserDataStore.getState().manualAccounts).toHaveLength(0);
      expect(Object.keys(useUserDataStore.getState().statusOverrides)).toHaveLength(0);
      expect(useScenarioStore.getState().scenarios).toHaveLength(0);
      expect(useUserDataStore.getState().manualEmployees).toHaveLength(0);
      expect(useFilterStore.getState().filters.serviceLine1.included).toHaveLength(0);
      expect(useWidgetRegistry.getState().widgets.size).toBe(0);

      // Theme and layout survive logout
      // (darkMode was reset in beforeEach — we just verify the store still exists)
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. deleteScenarioWithCleanup — full scenarios
  // ════════════════════════════════════════════════════════════════════════════

  describe("deleteScenarioWithCleanup — full scenarios", () => {
    it("creates a chain A → B → C and preserves inheritance", () => {
      const idA = useScenarioStore.getState().createScenario("Scenario A");
      const idB = useScenarioStore.getState().createScenario("Scenario B", idA);
      const idC = useScenarioStore.getState().createScenario("Scenario C", idB);

      expect(useScenarioStore.getState().scenarios).toHaveLength(3);

      const scB = useScenarioStore.getState().getScenarioById(idB)!;
      expect(scB.baseScenarioId).toBe(idA);

      const scC = useScenarioStore.getState().getScenarioById(idC)!;
      expect(scC.baseScenarioId).toBe(idB);
    });

    it("deleting middle scenario (B, not active) preserves editorStates", () => {
      const idA = useScenarioStore.getState().createScenario("Scenario A");
      const idB = useScenarioStore.getState().createScenario("Scenario B", idA);
      const idC = useScenarioStore.getState().createScenario("Scenario C", idB);

      // C is active (createScenario auto-activates)
      expect(useScenarioStore.getState().activeScenarioId).toBe(idC);

      // Add editor states
      useUserDataStore.getState().setEditorStates({
        EMP1: { baseline: [], actionLog: [], redoStack: [], current: [{ _uid: "seg1" } as any] },
        EMP2: { baseline: [], actionLog: [], redoStack: [], current: [{ _uid: "seg2" } as any] },
      });

      // Delete B (not active)
      deleteScenarioWithCleanup(idB);

      // Editor states preserved (active scenario C was not deleted)
      expect(Object.keys(useUserDataStore.getState().editorStates)).toHaveLength(2);
      expect((useUserDataStore.getState().editorStates["EMP1"] as any).current).toHaveLength(1);

      // Scenario B removed, A and C remain
      expect(useScenarioStore.getState().scenarios).toHaveLength(2);
      expect(useScenarioStore.getState().getScenarioById(idB)).toBeNull();
      expect(useScenarioStore.getState().activeScenarioId).toBe(idC);
    });

    it("deleting active scenario (C) clears editorStates", () => {
      const idA = useScenarioStore.getState().createScenario("Scenario A");
      const idB = useScenarioStore.getState().createScenario("Scenario B", idA);
      const idC = useScenarioStore.getState().createScenario("Scenario C", idB);

      // C is active
      expect(useScenarioStore.getState().activeScenarioId).toBe(idC);

      // Add editor states
      useUserDataStore.getState().setEditorStates({
        EMP1: { baseline: [], actionLog: [], redoStack: [], current: [{ _uid: "seg1" } as any] },
      });

      // Delete C (active)
      deleteScenarioWithCleanup(idC);

      // Editor states cleared
      expect(Object.keys(useUserDataStore.getState().editorStates)).toHaveLength(0);

      // Active scenario nulled
      expect(useScenarioStore.getState().activeScenarioId).toBeNull();
    });

    it("deleting B clears dangling baseScenarioId on C (falls back to null/real)", () => {
      const idA = useScenarioStore.getState().createScenario("Scenario A");
      const idB = useScenarioStore.getState().createScenario("Scenario B", idA);
      const idC = useScenarioStore.getState().createScenario("Scenario C", idB);

      // Before deletion, C points to B
      expect(useScenarioStore.getState().getScenarioById(idC)!.baseScenarioId).toBe(idB);

      // Delete B
      deleteScenarioWithCleanup(idB);

      // C's baseScenarioId is cleared (no dangling reference)
      const scC = useScenarioStore.getState().getScenarioById(idC)!;
      expect(scC.baseScenarioId).toBeNull();
    });

    it("remaining scenario A has no dangling baseScenarioId after B deletion", () => {
      const idA = useScenarioStore.getState().createScenario("Scenario A");
      const idB = useScenarioStore.getState().createScenario("Scenario B", idA);
      useScenarioStore.getState().createScenario("Scenario C", idB);

      // A has no base (root scenario)
      expect(useScenarioStore.getState().getScenarioById(idA)!.baseScenarioId).toBeNull();

      // Delete B
      deleteScenarioWithCleanup(idB);

      // A still has no base — no dangling reference introduced
      const scA = useScenarioStore.getState().getScenarioById(idA)!;
      expect(scA.baseScenarioId).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. STATUS_OPTIONS reactivity
  // ════════════════════════════════════════════════════════════════════════════

  describe("STATUS_OPTIONS reactivity (standalone module)", () => {
    it("default statusOptions has 7 entries", () => {
      expect(STATUS_OPTIONS).toHaveLength(7);
      expect(STATUS_OPTIONS.map((o) => o.status)).toEqual([1, 4, 6, 11, 13, 14, 15]);
    });

    it("updateStatusOptionsFromOptionSet updates labels from CRM OptionSet", () => {
      updateStatusOptionsFromOptionSet({
        1: "Prospect Identified",
        6: "Bid Submitted",
        14: "Revenue Booked",
      });

      expect(STATUS_OPTIONS.find((o) => o.status === 1)!.label).toBe("Prospect Identified");
      expect(STATUS_OPTIONS.find((o) => o.status === 6)!.label).toBe("Bid Submitted");
      expect(STATUS_OPTIONS.find((o) => o.status === 14)!.label).toBe("Revenue Booked");
    });

    it("updateStatusOptionsFromOptionSet preserves shortLabels unchanged", () => {
      const before = STATUS_OPTIONS.map((o) => ({ status: o.status, shortLabel: o.shortLabel }));

      updateStatusOptionsFromOptionSet({
        1: "New Lead Label",
        4: "New Go Label",
        6: "New Proposal Label",
      });

      before.forEach(({ status, shortLabel }) => {
        expect(STATUS_OPTIONS.find((o) => o.status === status)!.shortLabel).toBe(shortLabel);
      });
    });

    it("updateStatusOptionsFromOptionSet ignores unknown status numbers", () => {
      updateStatusOptionsFromOptionSet({
        999: "Unknown Status",
        0: "Zero Status",
        [-1]: "Negative Status",
      });

      expect(STATUS_OPTIONS).toHaveLength(7);
      // All labels unchanged
      expect(STATUS_OPTIONS.find((o) => o.status === 1)!.label).toBe("Lead Identified");
      expect(STATUS_OPTIONS.find((o) => o.status === 14)!.label).toBe("Booked");
    });

    it("partial update only changes matching statuses", () => {
      updateStatusOptionsFromOptionSet({ 11: "Deal Won" });

      expect(STATUS_OPTIONS.find((o) => o.status === 11)!.label).toBe("Deal Won");
      // Others unchanged
      expect(STATUS_OPTIONS.find((o) => o.status === 1)!.label).toBe("Lead Identified");
      expect(STATUS_OPTIONS.find((o) => o.status === 6)!.label).toBe("Proposal Submitted");
      expect(STATUS_OPTIONS.find((o) => o.status === 15)!.label).toBe("Lost");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. Cross-store data flow: Manual opportunity lifecycle
  // ════════════════════════════════════════════════════════════════════════════

  describe("Cross-store data flow: Manual opportunity lifecycle", () => {
    it("full lifecycle: account → opportunity → data → delete opp → delete account", () => {
      const store = useUserDataStore.getState();

      // ── Step 1: Create account ──
      store.addManualAccount({ account: "MegaCorp" });
      expect(useUserDataStore.getState().manualAccounts).toHaveLength(1);
      expect(useUserDataStore.getState().manualAccounts[0].account).toBe("MegaCorp");
      expect(useUserDataStore.getState().manualAccounts[0].isManual).toBe(true);

      // ── Step 2: Create opportunity under account ──
      store.addManualOpportunity(makeOpp("OPP-MEGA-1", "MegaCorp"));
      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(1);

      // ── Step 3: Add all data types to the opportunity ──
      store.setOpportunityActions("OPP-MEGA-1", [
        { id: "act1", description: "Follow up call", status: "open" } as any,
        { id: "act2", description: "Send proposal", status: "done" } as any,
      ]);
      store.setStaffingNeeds("OPP-MEGA-1", [
        { id: "need1", grade: "Senior Consultant", quantity: 2 } as any,
        { id: "need2", grade: "Manager", quantity: 1 } as any,
      ]);
      store.setRevenueTeam("OPP-MEGA-1", [
        { id: "rt1", name: "Alice", gradeBucket: "Director", percentage: 60 },
        { id: "rt2", name: "Bob", gradeBucket: "Partner", percentage: 40 },
      ]);
      store.setStatusOverride("OPP-MEGA-1", 6, 11, "Client confirmed");

      // Verify all data exists
      let s = useUserDataStore.getState();
      expect(s.opportunityActions["OPP-MEGA-1"]).toHaveLength(2);
      expect(s.staffingNeeds["OPP-MEGA-1"]).toHaveLength(2);
      expect(s.revenueTeam["OPP-MEGA-1"]).toHaveLength(2);
      expect(s.statusOverrides["OPP-MEGA-1"]).toBeDefined();
      expect(s.statusOverrides["OPP-MEGA-1"].newStatus).toBe(11);

      // ── Step 4: Delete the opportunity → cascade ──
      useUserDataStore.getState().deleteManualOpportunity("OPP-MEGA-1");

      s = useUserDataStore.getState();
      expect(s.manualOpportunities).toHaveLength(0);
      expect(s.opportunityActions["OPP-MEGA-1"]).toBeUndefined();
      expect(s.staffingNeeds["OPP-MEGA-1"]).toBeUndefined();
      expect(s.revenueTeam["OPP-MEGA-1"]).toBeUndefined();
      expect(s.statusOverrides["OPP-MEGA-1"]).toBeUndefined();

      // Account still exists after opp deletion
      expect(s.manualAccounts).toHaveLength(1);

      // ── Step 5: Delete account → final cleanup ──
      useUserDataStore.getState().deleteManualAccount("MegaCorp");

      s = useUserDataStore.getState();
      expect(s.manualAccounts).toHaveLength(0);
    });

    it("account delete cascades to all its opportunities and their data", () => {
      const store = useUserDataStore.getState();

      // Create account with 2 opportunities
      store.addManualAccount({ account: "MultiOpp Corp" });
      store.addManualOpportunity(makeOpp("OPP-MO-1", "MultiOpp Corp"));
      store.addManualOpportunity(makeOpp("OPP-MO-2", "MultiOpp Corp"));

      // Add data to both opportunities
      store.setOpportunityActions("OPP-MO-1", [{ id: "a1", description: "Task 1" } as any]);
      store.setStaffingNeeds("OPP-MO-1", [{ id: "n1", grade: "Consultant" } as any]);
      store.setStatusOverride("OPP-MO-1", 6, 14, "Booked");

      store.setRevenueTeam("OPP-MO-2", [{ id: "r2", name: "Eve", gradeBucket: "M/SM", percentage: 100 }]);
      store.setStatusOverride("OPP-MO-2", 6, 11, "Won");

      // Verify setup
      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(2);
      expect(Object.keys(useUserDataStore.getState().statusOverrides)).toHaveLength(2);

      // Delete account
      useUserDataStore.getState().deleteManualAccount("MultiOpp Corp");

      // Everything cascaded
      const s = useUserDataStore.getState();
      expect(s.manualAccounts).toHaveLength(0);
      expect(s.manualOpportunities).toHaveLength(0);
      expect(Object.keys(s.statusOverrides)).toHaveLength(0);
      expect(Object.keys(s.opportunityActions)).toHaveLength(0);
      expect(Object.keys(s.staffingNeeds)).toHaveLength(0);
      expect(Object.keys(s.revenueTeam)).toHaveLength(0);
    });

    it("deleting opportunity from one account does not affect another account's data", () => {
      const store = useUserDataStore.getState();

      // Two accounts, each with an opportunity
      store.addManualAccount({ account: "Corp A" });
      store.addManualAccount({ account: "Corp B" });
      store.addManualOpportunity(makeOpp("OPP-A", "Corp A"));
      store.addManualOpportunity(makeOpp("OPP-B", "Corp B"));
      store.setStatusOverride("OPP-A", 6, 14);
      store.setStatusOverride("OPP-B", 6, 11);
      store.setOpportunityActions("OPP-A", [{ id: "a1" } as any]);
      store.setOpportunityActions("OPP-B", [{ id: "b1" } as any]);

      // Delete only OPP-A
      useUserDataStore.getState().deleteManualOpportunity("OPP-A");

      const s = useUserDataStore.getState();
      // OPP-A gone
      expect(s.manualOpportunities).toHaveLength(1);
      expect(s.manualOpportunities[0].opportunityId).toBe("OPP-B");
      expect(s.statusOverrides["OPP-A"]).toBeUndefined();
      expect(s.opportunityActions["OPP-A"]).toBeUndefined();

      // OPP-B preserved
      expect(s.statusOverrides["OPP-B"]).toBeDefined();
      expect(s.opportunityActions["OPP-B"]).toHaveLength(1);

      // Both accounts still exist
      expect(s.manualAccounts).toHaveLength(2);
    });

    it("deleting one account does not affect another account's opportunities", () => {
      const store = useUserDataStore.getState();

      store.addManualAccount({ account: "Keep Corp" });
      store.addManualAccount({ account: "Delete Corp" });
      store.addManualOpportunity(makeOpp("OPP-KEEP", "Keep Corp"));
      store.addManualOpportunity(makeOpp("OPP-DEL", "Delete Corp"));
      store.setStaffingNeeds("OPP-KEEP", [{ id: "n1" } as any]);
      store.setStaffingNeeds("OPP-DEL", [{ id: "n2" } as any]);

      useUserDataStore.getState().deleteManualAccount("Delete Corp");

      const s = useUserDataStore.getState();
      expect(s.manualAccounts).toHaveLength(1);
      expect(s.manualAccounts[0].account).toBe("Keep Corp");
      expect(s.manualOpportunities).toHaveLength(1);
      expect(s.manualOpportunities[0].opportunityId).toBe("OPP-KEEP");
      expect(s.staffingNeeds["OPP-KEEP"]).toHaveLength(1);
      expect(s.staffingNeeds["OPP-DEL"]).toBeUndefined();
    });
  });
});
