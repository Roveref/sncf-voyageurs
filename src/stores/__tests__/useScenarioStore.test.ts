import { describe, it, expect, beforeEach } from "vitest";
import useScenarioStore from "../useScenarioStore";

describe("useScenarioStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useScenarioStore.setState({ scenarios: [], activeScenarioId: null });
  });

  // ── CRUD ──

  describe("createScenario", () => {
    it("creates a scenario and activates it", () => {
      const id = useScenarioStore.getState().createScenario("Test Scenario");
      const state = useScenarioStore.getState();
      expect(state.scenarios).toHaveLength(1);
      expect(state.scenarios[0].name).toBe("Test Scenario");
      expect(state.activeScenarioId).toBe(id);
    });

    it("creates scenario with base", () => {
      const baseId = useScenarioStore.getState().createScenario("Base");
      const childId = useScenarioStore.getState().createScenario("Child", baseId);
      const child = useScenarioStore.getState().getScenarioById(childId);
      expect(child?.baseScenarioId).toBe(baseId);
    });

    it("creates scenario with empty overrides", () => {
      const id = useScenarioStore.getState().createScenario("Empty");
      const sc = useScenarioStore.getState().getScenarioById(id);
      expect(sc?.assignmentOverrides).toEqual({});
      expect(sc?.employeeOverrides).toEqual({});
    });
  });

  describe("duplicateScenario", () => {
    it("creates a sibling copy with same base", () => {
      const baseId = useScenarioStore.getState().createScenario("Base");
      const origId = useScenarioStore.getState().createScenario("Original", baseId);

      // Add an override to original
      useScenarioStore.getState().upsertAssignmentOverride("key1", {
        type: "create",
        data: { empId: "E1", jobNo: "J1", startDate: "2025-01-01" },
      });

      const dupId = useScenarioStore.getState().duplicateScenario(origId, "Duplicate");
      expect(dupId).not.toBeNull();

      const dup = useScenarioStore.getState().getScenarioById(dupId!);
      expect(dup?.name).toBe("Duplicate");
      expect(dup?.baseScenarioId).toBe(baseId); // same base, not child
      expect(dup?.assignmentOverrides["key1"]).toBeDefined();
    });

    it("returns null for non-existent scenario", () => {
      const result = useScenarioStore.getState().duplicateScenario("fake-id", "Copy");
      expect(result).toBeNull();
    });
  });

  describe("deleteScenario", () => {
    it("removes scenario and deactivates if active", () => {
      const id = useScenarioStore.getState().createScenario("ToDelete");
      expect(useScenarioStore.getState().activeScenarioId).toBe(id);

      useScenarioStore.getState().deleteScenario(id);
      expect(useScenarioStore.getState().scenarios).toHaveLength(0);
      expect(useScenarioStore.getState().activeScenarioId).toBeNull();
    });

    it("clears base reference in child scenarios", () => {
      const parentId = useScenarioStore.getState().createScenario("Parent");
      const childId = useScenarioStore.getState().createScenario("Child", parentId);

      useScenarioStore.getState().deleteScenario(parentId);
      const child = useScenarioStore.getState().getScenarioById(childId);
      expect(child?.baseScenarioId).toBeNull();
    });
  });

  describe("renameScenario", () => {
    it("renames a scenario", () => {
      const id = useScenarioStore.getState().createScenario("Old Name");
      useScenarioStore.getState().renameScenario(id, "New Name");
      expect(useScenarioStore.getState().getScenarioById(id)?.name).toBe("New Name");
    });
  });

  // ── Mutations ──

  describe("upsertAssignmentOverride", () => {
    it("adds override to active scenario", () => {
      const id = useScenarioStore.getState().createScenario("Test");
      useScenarioStore.getState().upsertAssignmentOverride("E1::J1::2025-01-01", {
        type: "create",
        data: { empId: "E1", jobNo: "J1", startDate: "2025-01-01" },
      });
      const sc = useScenarioStore.getState().getScenarioById(id);
      expect(sc?.assignmentOverrides["E1::J1::2025-01-01"]).toBeDefined();
    });

    it("does nothing when no active scenario", () => {
      useScenarioStore.setState({ activeScenarioId: null });
      useScenarioStore.getState().upsertAssignmentOverride("key", {
        type: "create",
        data: { empId: "E1", jobNo: "J1", startDate: "2025-01-01" },
      });
      // No crash, no change
      expect(useScenarioStore.getState().scenarios).toHaveLength(0);
    });
  });

  describe("removeAssignmentOverride", () => {
    it("removes override from active scenario", () => {
      const id = useScenarioStore.getState().createScenario("Test");
      useScenarioStore.getState().upsertAssignmentOverride("key1", {
        type: "create",
        data: { empId: "E1", jobNo: "J1", startDate: "2025-01-01" },
      });
      useScenarioStore.getState().removeAssignmentOverride("key1");
      const sc = useScenarioStore.getState().getScenarioById(id);
      expect(sc?.assignmentOverrides["key1"]).toBeUndefined();
    });
  });

  // ── Inheritance ──

  describe("resolveAssignmentOverrides", () => {
    it("returns own overrides for root scenario", () => {
      const id = useScenarioStore.getState().createScenario("Root");
      useScenarioStore.getState().upsertAssignmentOverride("key1", {
        type: "create",
        data: { empId: "E1", jobNo: "J1", startDate: "2025-01-01" },
      });
      const resolved = useScenarioStore.getState().resolveAssignmentOverrides(id);
      expect(Object.keys(resolved)).toHaveLength(1);
    });

    it("merges parent and child overrides (child wins)", () => {
      const parentId = useScenarioStore.getState().createScenario("Parent");
      useScenarioStore.getState().upsertAssignmentOverride("shared_key", {
        type: "create",
        data: { empId: "E1", jobNo: "J1", startDate: "2025-01-01" },
      });
      useScenarioStore.getState().upsertAssignmentOverride("parent_only", {
        type: "create",
        data: { empId: "E2", jobNo: "J2", startDate: "2025-02-01" },
      });

      const childId = useScenarioStore.getState().createScenario("Child", parentId);
      useScenarioStore.getState().upsertAssignmentOverride("shared_key", {
        type: "edit",
        data: { empId: "E1", jobNo: "J1", startDate: "2025-01-01", utilization: 50 },
      });
      useScenarioStore.getState().upsertAssignmentOverride("child_only", {
        type: "create",
        data: { empId: "E3", jobNo: "J3", startDate: "2025-03-01" },
      });

      const resolved = useScenarioStore.getState().resolveAssignmentOverrides(childId);
      expect(Object.keys(resolved)).toHaveLength(3); // shared + parent_only + child_only
      expect(resolved["shared_key"].type).toBe("edit"); // child wins
      expect(resolved["parent_only"]).toBeDefined();
      expect(resolved["child_only"]).toBeDefined();
    });

    it("handles 3-level inheritance chain", () => {
      const grandparentId = useScenarioStore.getState().createScenario("GP");
      useScenarioStore.getState().upsertAssignmentOverride("gp_key", {
        type: "create",
        data: { empId: "E1", jobNo: "J1", startDate: "2025-01-01" },
      });

      const parentId = useScenarioStore.getState().createScenario("P", grandparentId);
      useScenarioStore.getState().upsertAssignmentOverride("p_key", {
        type: "create",
        data: { empId: "E2", jobNo: "J2", startDate: "2025-02-01" },
      });

      const childId = useScenarioStore.getState().createScenario("C", parentId);
      useScenarioStore.getState().upsertAssignmentOverride("c_key", {
        type: "create",
        data: { empId: "E3", jobNo: "J3", startDate: "2025-03-01" },
      });

      const resolved = useScenarioStore.getState().resolveAssignmentOverrides(childId);
      expect(Object.keys(resolved)).toHaveLength(3);
    });

    it("handles circular reference without infinite loop", () => {
      const id1 = useScenarioStore.getState().createScenario("A");
      const id2 = useScenarioStore.getState().createScenario("B", id1);
      // Manually create circular reference
      useScenarioStore.setState((s) => ({
        scenarios: s.scenarios.map((sc) => (sc.id === id1 ? { ...sc, baseScenarioId: id2 } : sc)),
      }));
      // Should not infinite loop
      const resolved = useScenarioStore.getState().resolveAssignmentOverrides(id2);
      expect(resolved).toBeDefined();
    });
  });

  // ── Persistence ──

  describe("loadFromJson / toJson", () => {
    it("round-trips scenarios", () => {
      useScenarioStore.getState().createScenario("S1");
      useScenarioStore.getState().createScenario("S2");

      const json = useScenarioStore.getState().toJson();
      expect(json).toHaveLength(2);

      // Clear and reload
      useScenarioStore.setState({ scenarios: [], activeScenarioId: null });
      useScenarioStore.getState().loadFromJson(json);
      expect(useScenarioStore.getState().scenarios).toHaveLength(2);
      expect(useScenarioStore.getState().scenarios[0].name).toBe("S1");
    });
  });
});
