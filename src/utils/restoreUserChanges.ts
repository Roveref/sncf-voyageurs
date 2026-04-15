/**
 * Restaurer les modifications utilisateur dans les stores appropriés.
 * Extracted from useBackendHydration for reuse by useHydration, useServerEventsV2, ChatPanel.
 */

import { useUserDataStore } from "../stores/useUserDataStore";
import useScenarioStore from "../stores/useScenarioStore";
import type { EditorState } from "../components/StaffingTab/components/Edit/bulkEditTypes";

export function restoreUserChanges(changes: Record<string, unknown>) {
  const store = useUserDataStore.getState();

  // Editor states — single source of truth for MDS edits.
  if (
    changes.editorStates &&
    typeof changes.editorStates === "object" &&
    Object.keys(changes.editorStates).length > 0
  ) {
    store.setEditorStates(changes.editorStates as Record<string, EditorState | null>);
  }

  // Employee metadata overrides — store raw overrides only (merge happens at read-time in useMergedEmployeeData).
  if (changes.employeeMetadata && typeof changes.employeeMetadata === "object") {
    store.setOverrides(changes.employeeMetadata as Record<string, any>);
  }

  // Manual employees
  if (Array.isArray(changes.manualEmployees) && changes.manualEmployees.length > 0) {
    store.setManualEmployees(changes.manualEmployees as any[]);
  }

  // Scenarios
  if (Array.isArray(changes.scenarios)) {
    useScenarioStore.getState().loadFromJson(changes.scenarios as any[]);
  }

  // User data fields
  if (changes.statusOverrides && typeof changes.statusOverrides === "object") {
    store.setStatusOverrides(changes.statusOverrides as Record<string, any>);
  }
  if (Array.isArray(changes.manualOpportunities)) {
    store.setManualOpportunities(changes.manualOpportunities as any[]);
  }
  if (Array.isArray(changes.manualAccounts)) {
    store.setManualAccounts(changes.manualAccounts as any[]);
  }
  // Bulk-set record fields (actions, needs, revenueTeam)
  const recordFields: Array<{ key: string; setter: (all: Record<string, any[]>) => void }> = [
    { key: "opportunityActions", setter: store.setAllOpportunityActions },
    { key: "staffingNeeds", setter: store.setAllStaffingNeeds },
    { key: "revenueTeam", setter: store.setAllRevenueTeam },
  ];
  for (const { key, setter } of recordFields) {
    if (changes[key] && typeof changes[key] === "object") {
      setter(changes[key] as Record<string, any[]>);
    }
  }
}
