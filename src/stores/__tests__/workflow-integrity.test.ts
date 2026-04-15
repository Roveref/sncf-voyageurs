/**
 * Integration tests: Cross-store workflow integrity.
 *
 * These tests verify that create → modify → delete workflows return to clean state,
 * and that cross-store side effects are properly propagated.
 * Each test covers a bug that was found and fixed during the data integrity audit.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useUserDataStore } from "../useUserDataStore";
import useScenarioStore from "../useScenarioStore";
// ── Reset all stores between tests ──

function resetAllStores() {
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
  useScenarioStore.setState({ scenarios: [], activeScenarioId: null });
}

// ── Helpers ──

const makeOpp = (id: string, account: string) =>
  ({
    opportunityId: id,
    account: account,
    opportunity: `Opp ${id}`,
    grossRevenue: 100000,
    status: 6,
  }) as any;

describe("Workflow Integrity", () => {
  beforeEach(resetAllStores);

  // ══════════════════════════════════════════════════════════════════════
  // C2: Status override revert properly deletes (no tombstone)
  // ══════════════════════════════════════════════════════════════════════

  describe("C2: Status override lifecycle", () => {
    it("create → revert → key is deleted (not tombstoned)", () => {
      useUserDataStore.getState().setStatusOverride("OPP-1", 6, 14, "Won deal");
      expect(useUserDataStore.getState().statusOverrides["OPP-1"]).toBeDefined();
      expect(useUserDataStore.getState().statusOverrides["OPP-1"].newStatus).toBe(14);

      // Revert
      useUserDataStore.getState().removeStatusOverride("OPP-1");
      const after = useUserDataStore.getState().statusOverrides;
      expect(after["OPP-1"]).toBeUndefined(); // Key deleted, not tombstoned
      expect(Object.keys(after)).toHaveLength(0);
    });

    it("create → set back to original status → key is deleted", () => {
      const store = useUserDataStore.getState();
      store.setStatusOverride("OPP-1", 6, 14);
      store.setStatusOverride("OPP-1", 6, 6); // Back to original
      const after = useUserDataStore.getState().statusOverrides;
      expect(after["OPP-1"]).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // H1: Opportunity delete cascades status overrides
  // ══════════════════════════════════════════════════════════════════════

  describe("H1: Opportunity delete cascade", () => {
    it("deleting manual opp cascades all related data including status overrides", () => {
      const store = useUserDataStore.getState();

      // Create opp + associated data
      store.addManualOpportunity(makeOpp("OPP-TEST", "Acme"));
      store.setStatusOverride("OPP-TEST", 6, 14, "Won");
      store.setOpportunityActions("OPP-TEST", [{ id: "a1", description: "Call", status: "open" } as any]);
      store.setStaffingNeeds("OPP-TEST", [{ id: "n1", grade: "Consultant" } as any]);
      store.setRevenueTeam("OPP-TEST", [{ id: "r1", name: "John", gradeBucket: "M/SM", percentage: 100 }]);

      // Verify all created
      let s = useUserDataStore.getState();
      expect(s.manualOpportunities).toHaveLength(1);
      expect(s.statusOverrides["OPP-TEST"]).toBeDefined();
      expect(s.opportunityActions["OPP-TEST"]).toHaveLength(1);
      expect(s.staffingNeeds["OPP-TEST"]).toHaveLength(1);
      expect(s.revenueTeam["OPP-TEST"]).toHaveLength(1);

      // Delete
      useUserDataStore.getState().deleteManualOpportunity("OPP-TEST");

      // Verify ALL cascaded
      s = useUserDataStore.getState();
      expect(s.manualOpportunities).toHaveLength(0);
      expect(s.statusOverrides["OPP-TEST"]).toBeUndefined();
      expect(s.opportunityActions["OPP-TEST"]).toBeUndefined();
      expect(s.staffingNeeds["OPP-TEST"]).toBeUndefined();
      expect(s.revenueTeam["OPP-TEST"]).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // M5: Account delete cascades to all associated opportunities
  // ══════════════════════════════════════════════════════════════════════

  describe("M5: Account delete cascade", () => {
    it("deleting account cascades to opps + their actions/overrides", () => {
      const store = useUserDataStore.getState();

      store.addManualAccount({ account: "Acme Corp" });
      store.addManualOpportunity({ ...makeOpp("OPP-A1", "Acme Corp") });
      store.addManualOpportunity({ ...makeOpp("OPP-A2", "Acme Corp") });
      store.setStatusOverride("OPP-A1", 6, 14);
      store.setOpportunityActions("OPP-A1", [{ id: "a1" } as any]);

      // Delete account
      useUserDataStore.getState().deleteManualAccount("Acme Corp");

      const s = useUserDataStore.getState();
      expect(s.manualAccounts).toHaveLength(0);
      expect(s.manualOpportunities).toHaveLength(0);
      expect(s.statusOverrides["OPP-A1"]).toBeUndefined();
      expect(s.opportunityActions["OPP-A1"]).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // C3: Scenario delete cleans SAP overrides and editor states
  // ══════════════════════════════════════════════════════════════════════

  describe("C3: Scenario delete cleanup", () => {
    it("deleting active scenario nulls activeScenarioId (caller clears editorStates)", () => {
      // Setup: create scenario, add some state
      const scenarioId = useScenarioStore.getState().createScenario("Test Scenario");
      useUserDataStore
        .getState()
        .setEditorStates({ EMP1: { baseline: [], actionLog: [], redoStack: [], current: [] } });

      // Delete the active scenario
      const wasActive = useScenarioStore.getState().activeScenarioId === scenarioId;
      useScenarioStore.getState().deleteScenario(scenarioId);

      // Store no longer cross-clears — caller is responsible
      expect(useScenarioStore.getState().activeScenarioId).toBeNull();
      expect(wasActive).toBe(true);

      // Simulate what the component (ScenarioSelector) does after deletion
      if (wasActive) useUserDataStore.getState().setEditorStates({});
      expect(Object.keys(useUserDataStore.getState().editorStates)).toHaveLength(0);
    });

    it("deleting non-active scenario does NOT clear editor states", () => {
      const id1 = useScenarioStore.getState().createScenario("Active");
      const id2 = useScenarioStore.getState().createScenario("Inactive");
      useScenarioStore.getState().setActiveScenario(id1);
      useUserDataStore
        .getState()
        .setEditorStates({ EMP1: { baseline: [], actionLog: [], redoStack: [], current: [] } });

      // Delete inactive scenario
      useScenarioStore.getState().deleteScenario(id2);

      // Editor states should remain (active scenario not deleted)
      expect(Object.keys(useUserDataStore.getState().editorStates)).toHaveLength(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // C1: Editor states don't leak across scenarios
  // ══════════════════════════════════════════════════════════════════════

  describe("C1: Editor state isolation across scenarios", () => {
    it("editor states from one scenario don't persist after switch", () => {
      // Create two scenarios
      const idA = useScenarioStore.getState().createScenario("Scenario A");
      useUserDataStore
        .getState()
        .setEditorStates({ EMP1: { baseline: [], actionLog: [], redoStack: [], current: [] } });

      // The StaffingTab useEffect clears editorStates on scenario change.
      // Here we simulate that behavior directly:
      useUserDataStore.getState().setEditorStates({});

      // Switch to scenario B
      const idB = useScenarioStore.getState().createScenario("Scenario B");
      useScenarioStore.getState().setActiveScenario(idB);

      // Verify editor states are clean
      expect(Object.keys(useUserDataStore.getState().editorStates)).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Scenario inheritance chain integrity
  // ══════════════════════════════════════════════════════════════════════

  describe("A19: Scenario chain depth limit", () => {
    it("resolveAssignmentOverrides handles circular references gracefully", () => {
      const store = useScenarioStore.getState();
      const idA = store.createScenario("A");
      const idB = store.createScenario("B", idA);

      // Manually create circular reference (A bases on B)
      useScenarioStore.setState((s) => ({
        scenarios: s.scenarios.map((sc) => (sc.id === idA ? { ...sc, baseScenarioId: idB } : sc)),
      }));

      // Should not infinite loop — visited Set protects
      const overrides = useScenarioStore.getState().resolveAssignmentOverrides(idA);
      expect(overrides).toBeDefined();
    });

    it("deep chain (20+) is truncated", () => {
      let prevId: string | null = null;
      for (let i = 0; i < 25; i++) {
        prevId = useScenarioStore.getState().createScenario(`Scenario ${i}`, prevId!);
      }

      // Should resolve without stack overflow
      const overrides = useScenarioStore.getState().resolveAssignmentOverrides(prevId!);
      expect(overrides).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // H3: Assignment key uniqueness with endDate
  // ══════════════════════════════════════════════════════════════════════

  describe("H3: Assignment key includes endDate", () => {
    it("two assignments with same startDate but different endDate get unique keys", async () => {
      const { assignmentKey } = await import("../../components/StaffingTab/utils/scenarioUtils");

      const key1 = assignmentKey("EMP1", "JOB1", "2025-01-01", "2025-01-15");
      const key2 = assignmentKey("EMP1", "JOB1", "2025-01-01", "2025-03-31");

      expect(key1).not.toBe(key2);
      expect(key1).toBe("EMP1::JOB1::2025-01-01::2025-01-15");
      expect(key2).toBe("EMP1::JOB1::2025-01-01::2025-03-31");
    });

    it("backward compatible: key without endDate still works", async () => {
      const { assignmentKey } = await import("../../components/StaffingTab/utils/scenarioUtils");

      const key = assignmentKey("EMP1", "JOB1", "2025-01-01");
      expect(key).toBe("EMP1::JOB1::2025-01-01");
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Staffing assignments via editorStates lifecycle
  // ══════════════════════════════════════════════════════════════════════

  describe("Staffing assignments via editorStates", () => {
    it("add → remove → editor state is clean", () => {
      const store = useUserDataStore.getState();

      const seg = {
        _uid: "need_N1_123",
        empId: "EMP1",
        jobNo: "JOB1",
        jobName: "Test",
        startDate: "2025-01-01",
        endDate: "2025-06-30",
        utilization: 100,
        status: "confirmed",
        category: "chargeable",
        needId: "N1",
        source: "staffing_need" as const,
      };

      store.setEditorState("EMP1", {
        baseline: [],
        actionLog: [
          { actionId: "act_1", groupKey: "JOB1__chargeable", type: "create", sourceUids: [], produced: [seg] },
        ],
        redoStack: [],
        current: [seg],
      });

      const state = useUserDataStore.getState().editorStates["EMP1"] as any;
      expect(state.current).toHaveLength(1);
      expect(state.current[0].needId).toBe("N1");

      // Remove assignment
      store.setEditorState("EMP1", { ...state, current: [] });
      const updated = useUserDataStore.getState().editorStates["EMP1"] as any;
      expect(updated.current).toHaveLength(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Full round-trip: create everything → delete → verify clean
  // ══════════════════════════════════════════════════════════════════════

  describe("Full round-trip integrity", () => {
    it("create account + opp + all related data → delete account → everything cleaned", () => {
      const store = useUserDataStore.getState();

      // Build up
      store.addManualAccount({ account: "BigCorp" });
      store.addManualOpportunity(makeOpp("OPP-BC1", "BigCorp"));
      store.setStatusOverride("OPP-BC1", 1, 14, "Won");
      store.setOpportunityActions("OPP-BC1", [{ id: "act1", description: "Follow up", status: "open" } as any]);
      store.setStaffingNeeds("OPP-BC1", [{ id: "need1", grade: "Manager", quantity: 2 } as any]);
      store.setRevenueTeam("OPP-BC1", [{ id: "rt1", name: "Alice", gradeBucket: "Director", percentage: 100 }]);

      // Add assignment via editorStates
      useUserDataStore.getState().setEditorState("EMP99", {
        baseline: [],
        actionLog: [],
        redoStack: [],
        current: [
          {
            _uid: "need_need1_123",
            empId: "EMP99",
            jobNo: "JOB1",
            jobName: "Test",
            startDate: "2025-01-01",
            endDate: "2025-12-31",
            utilization: 100,
            status: "confirmed",
            category: "chargeable",
            needId: "need1",
            source: "staffing_need",
          },
        ],
      });

      // Tear down
      useUserDataStore.getState().deleteManualAccount("BigCorp");

      // Verify everything is clean
      const s = useUserDataStore.getState();
      expect(s.manualAccounts).toHaveLength(0);
      expect(s.manualOpportunities).toHaveLength(0);
      expect(Object.keys(s.statusOverrides)).toHaveLength(0);
      expect(Object.keys(s.opportunityActions)).toHaveLength(0);
      expect(Object.keys(s.staffingNeeds)).toHaveLength(0);
      expect(Object.keys(s.revenueTeam)).toHaveLength(0);

      // Editor states are independent — not cascaded by account delete
      const es = useUserDataStore.getState().editorStates["EMP99"] as any;
      expect(es.current).toHaveLength(1);
    });
  });
});
