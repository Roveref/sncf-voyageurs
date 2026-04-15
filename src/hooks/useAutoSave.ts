/**
 * useAutoSave — Dirty-detection + debounced save for user data.
 *
 * Compares JSON snapshots of 10 store sections every 2s (debounced).
 * Only sends sections that actually changed (value comparison, not reference).
 * Sets lastSavedAt on success — used by SSE handler to suppress echo refetches.
 */

import { useEffect, useRef } from "react";
import { useUserDataStore } from "../stores/useUserDataStore";
import useScenarioStore from "../stores/useScenarioStore";
import { checkBackendHealth } from "../services/api";
import { useLoadingStore } from "../stores/useLoadingStore";
import { useSaveChangesMutation } from "../queries/useSaveChangesMutation";

const DEBOUNCE_MS = 2000;
const INIT_DELAY_MS = 8000;

/**
 * Snapshot the current store state into useAutoSave's baseline,
 * so externally restored data (SSE cross-tab sync) isn't detected as dirty.
 * Set by useAutoSave on mount, called from useHydration after restoreUserChanges.
 */
let _baselineUpdater: (() => void) | null = null;
export function updateAutoSaveBaseline() {
  if (_baselineUpdater) _baselineUpdater();
}

export function useAutoSave() {
  const mutation = useSaveChangesMutation();
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const backendAvailable = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const prevJsonRef = useRef<Record<string, string>>({});

  /** Snapshot current store state into prevJsonRef (baseline). */
  const takeBaseline = () => {
    const ud = useUserDataStore.getState();
    const state: Record<string, unknown> = {
      statusOverrides: ud.statusOverrides,
      manualOpportunities: ud.manualOpportunities,
      manualAccounts: ud.manualAccounts,
      opportunityActions: ud.opportunityActions,
      staffingNeeds: ud.staffingNeeds,
      revenueTeam: ud.revenueTeam,
      editorStates: ud.editorStates,
      employeeMetadata: ud.employeeOverrides,
      manualEmployees: ud.manualEmployees,
      scenarios: useScenarioStore.getState().scenarios,
    };
    const snap: Record<string, string> = {};
    for (const [k, v] of Object.entries(state)) snap[k] = JSON.stringify(v);
    prevJsonRef.current = snap;
  };

  useEffect(() => {
    checkBackendHealth().then((ok) => {
      backendAvailable.current = ok;
    });
    // Register baseline updater for cross-tab sync
    _baselineUpdater = takeBaseline;
    return () => {
      _baselineUpdater = null;
    };
  }, []);

  // Take baseline snapshot after hydration completes (8s delay)
  useEffect(() => {
    if (!initializedRef.current) {
      const timeout = setTimeout(() => {
        takeBaseline();
        initializedRef.current = true;
      }, INIT_DELAY_MS);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, []);

  // Store subscriptions
  const statusOverrides = useUserDataStore((s) => s.statusOverrides);
  const manualOpportunities = useUserDataStore((s) => s.manualOpportunities);
  const manualAccounts = useUserDataStore((s) => s.manualAccounts);
  const opportunityActions = useUserDataStore((s) => s.opportunityActions);
  const staffingNeeds = useUserDataStore((s) => s.staffingNeeds);
  const revenueTeam = useUserDataStore((s) => s.revenueTeam);
  const editorStates = useUserDataStore((s) => s.editorStates);
  const employeeMetadata = useUserDataStore((s) => s.employeeOverrides);
  const manualEmployees = useUserDataStore((s) => s.manualEmployees);
  const scenarios = useScenarioStore((s) => s.scenarios);

  // Sync mutation status → useLoadingStore
  useEffect(() => {
    if (mutation.isPending) useLoadingStore.getState().setSyncStatus("saving");
    else if (mutation.isSuccess) {
      useLoadingStore.getState().setSyncStatus("saved");
      useLoadingStore.getState().setLastSavedAt(Date.now());
    } else if (mutation.isError) useLoadingStore.getState().setSyncStatus("error");
  }, [mutation.isPending, mutation.isSuccess, mutation.isError]);

  // Debounced dirty-detection + save
  useEffect(() => {
    if (!initializedRef.current || !backendAvailable.current) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      const allSections: Record<string, unknown> = {
        statusOverrides,
        manualOpportunities,
        manualAccounts,
        opportunityActions,
        staffingNeeds,
        revenueTeam,
        editorStates,
        employeeMetadata,
        manualEmployees,
        scenarios,
      };

      const dirty: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(allSections)) {
        const json = JSON.stringify(value);
        if (json !== prevJsonRef.current[key]) {
          dirty[key] = value;
          prevJsonRef.current[key] = json;
        }
      }

      if (Object.keys(dirty).length === 0) return;

      mutateRef.current(dirty);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [
    statusOverrides,
    manualOpportunities,
    manualAccounts,
    opportunityActions,
    staffingNeeds,
    revenueTeam,
    editorStates,
    employeeMetadata,
    manualEmployees,
    scenarios,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);
}
