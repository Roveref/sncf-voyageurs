import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Scenario, AssignmentOverride, EmployeeOverride } from "../components/StaffingTab/types";

// ── Store shape ──
export interface ScenarioState {
  scenarios: Scenario[];
  activeScenarioId: string | null;

  // Derived
  getActiveScenario: () => Scenario | null;
  getScenarioById: (id: string) => Scenario | null;

  // CRUD
  createScenario: (name: string, baseScenarioId?: string | null, description?: string) => string;
  duplicateScenario: (id: string, newName: string) => string | null;
  deleteScenario: (id: string) => void;
  renameScenario: (id: string, name: string) => void;

  // Activation
  setActiveScenario: (id: string | null) => void;

  // Mutations on active scenario
  upsertAssignmentOverride: (key: string, override: AssignmentOverride) => void;
  removeAssignmentOverride: (key: string) => void;
  upsertEmployeeOverride: (empId: string, override: EmployeeOverride) => void;
  removeEmployeeOverride: (empId: string) => void;

  // Resolve the full override chain (inheritance)
  resolveAssignmentOverrides: (scenarioId: string) => Record<string, AssignmentOverride>;
  resolveEmployeeOverrides: (scenarioId: string) => Record<string, EmployeeOverride>;

  // Persistence
  loadFromJson: (scenarios: Scenario[]) => void;
  toJson: () => Scenario[];
}

const now = () => new Date().toISOString();
const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const useScenarioStore = create<ScenarioState>()(
  devtools(
    (set, get) => ({
      scenarios: [],
      activeScenarioId: null,

      // ── Derived ──
      getActiveScenario: () => {
        const { scenarios, activeScenarioId } = get();
        return activeScenarioId ? scenarios.find((s) => s.id === activeScenarioId) || null : null;
      },
      getScenarioById: (id) => get().scenarios.find((s) => s.id === id) || null,

      // ── CRUD ──
      createScenario: (name, baseScenarioId = null, description = "") => {
        const id = genId();
        const scenario: Scenario = {
          id,
          name,
          description,
          createdAt: now(),
          updatedAt: now(),
          baseScenarioId,
          assignmentOverrides: {},
          employeeOverrides: {},
        };
        set((s) => {
          const next = [...s.scenarios, scenario];

          return { scenarios: next, activeScenarioId: id };
        });
        return id;
      },

      duplicateScenario: (id, newName) => {
        const source = get().getScenarioById(id);
        if (!source) return null;
        const newId = genId();
        const dup: Scenario = {
          ...source,
          id: newId,
          name: newName,
          createdAt: now(),
          updatedAt: now(),
          // Duplicate keeps the same base — it's a sibling, not a child
          assignmentOverrides: { ...source.assignmentOverrides },
          employeeOverrides: { ...source.employeeOverrides },
        };
        set((s) => {
          const next = [...s.scenarios, dup];

          return { scenarios: next };
        });
        return newId;
      },

      deleteScenario: (id) => {
        set((s) => {
          const next = s.scenarios
            .filter((sc) => sc.id !== id)
            // Also clear any scenario that had this as base → fall back to real
            .map((sc) => (sc.baseScenarioId === id ? { ...sc, baseScenarioId: null } : sc));

          return {
            scenarios: next,
            activeScenarioId: s.activeScenarioId === id ? null : s.activeScenarioId,
            // Callers must clear editor states when switching away from a deleted scenario
          };
        });
      },

      renameScenario: (id, name) => {
        set((s) => {
          const next = s.scenarios.map((sc) => (sc.id === id ? { ...sc, name, updatedAt: now() } : sc));

          return { scenarios: next };
        });
      },

      // ── Activation ──
      setActiveScenario: (id) => set({ activeScenarioId: id }),

      // ── Mutations ──
      upsertAssignmentOverride: (key, override) => {
        set((s) => {
          const active = s.scenarios.find((sc) => sc.id === s.activeScenarioId);
          if (!active) return s;
          const updated = {
            ...active,
            updatedAt: now(),
            assignmentOverrides: { ...active.assignmentOverrides, [key]: override },
          };
          const next = s.scenarios.map((sc) => (sc.id === active.id ? updated : sc));

          return { scenarios: next };
        });
      },

      removeAssignmentOverride: (key) => {
        set((s) => {
          const active = s.scenarios.find((sc) => sc.id === s.activeScenarioId);
          if (!active) return s;
          const { [key]: _, ...rest } = active.assignmentOverrides;
          const updated = { ...active, updatedAt: now(), assignmentOverrides: rest };
          const next = s.scenarios.map((sc) => (sc.id === active.id ? updated : sc));

          return { scenarios: next };
        });
      },

      upsertEmployeeOverride: (empId, override) => {
        set((s) => {
          const active = s.scenarios.find((sc) => sc.id === s.activeScenarioId);
          if (!active) return s;
          const existing = active.employeeOverrides[empId] || {};
          const merged = { ...existing, ...override, metadata: { ...existing.metadata, ...override.metadata } };
          const updated = {
            ...active,
            updatedAt: now(),
            employeeOverrides: { ...active.employeeOverrides, [empId]: merged },
          };
          const next = s.scenarios.map((sc) => (sc.id === active.id ? updated : sc));

          return { scenarios: next };
        });
      },

      removeEmployeeOverride: (empId) => {
        set((s) => {
          const active = s.scenarios.find((sc) => sc.id === s.activeScenarioId);
          if (!active) return s;
          const { [empId]: _, ...rest } = active.employeeOverrides;
          const updated = { ...active, updatedAt: now(), employeeOverrides: rest };
          const next = s.scenarios.map((sc) => (sc.id === active.id ? updated : sc));

          return { scenarios: next };
        });
      },

      // ── Inheritance resolution ──
      resolveAssignmentOverrides: (scenarioId) => {
        const { scenarios } = get();
        const chain: Record<string, AssignmentOverride>[] = [];
        let currentId: string | null = scenarioId;
        const visited = new Set<string>();
        const MAX_CHAIN_DEPTH = 20;

        while (currentId && !visited.has(currentId) && visited.size < MAX_CHAIN_DEPTH) {
          visited.add(currentId);
          const sc = scenarios.find((s) => s.id === currentId);
          if (!sc) break;
          chain.unshift(sc.assignmentOverrides); // parent first
          currentId = sc.baseScenarioId;
        }

        // Merge: parent overrides first, child overrides win
        const merged: Record<string, AssignmentOverride> = {};
        chain.forEach((overrides) => Object.assign(merged, overrides));
        return merged;
      },

      resolveEmployeeOverrides: (scenarioId) => {
        const { scenarios } = get();
        const chain: Record<string, EmployeeOverride>[] = [];
        let currentId: string | null = scenarioId;
        const visited = new Set<string>();

        while (currentId && !visited.has(currentId) && visited.size < 20) {
          visited.add(currentId);
          const sc = scenarios.find((s) => s.id === currentId);
          if (!sc) break;
          chain.unshift(sc.employeeOverrides);
          currentId = sc.baseScenarioId;
        }

        const merged: Record<string, EmployeeOverride> = {};
        chain.forEach((overrides) => {
          Object.entries(overrides).forEach(([empId, ov]) => {
            if (!merged[empId]) {
              merged[empId] = { ...ov };
            } else {
              merged[empId] = {
                ...merged[empId],
                ...ov,
                metadata: { ...merged[empId].metadata, ...ov.metadata },
              };
            }
          });
        });
        return merged;
      },

      // ── Persistence ──
      loadFromJson: (scenarios) => set({ scenarios }),
      toJson: () => get().scenarios,
    }),
    { name: "ScenarioStore" }
  )
);

export default useScenarioStore;
