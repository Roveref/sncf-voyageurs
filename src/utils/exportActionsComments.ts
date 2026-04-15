/**
 * Export and Import utilities for Actions
 * Handles JSON export/import for actions data
 * Compatible with StatusOverrideManager export format
 */

import { useUserDataStore } from "../stores/useUserDataStore";

/**
 * Export actions to JSON format
 */
export const exportActionsComments = (
  selectedOpportunities: any[] = [],
  exportAll: boolean = false
): Record<string, any> | null => {
  const allActions: any[] = [];
  const { opportunityActions } = useUserDataStore.getState();

  Object.entries(opportunityActions).forEach(([opportunityId, actions]) => {
    if (
      exportAll ||
      selectedOpportunities.length === 0 ||
      selectedOpportunities.some((opp) => opp.opportunityId === opportunityId)
    ) {
      actions.forEach((action) => {
        allActions.push({
          opportunityId: action.opportunityId || opportunityId,
          opportunityName: action.opportunityName || "",
          id: action.id,
          owner: action.owner,
          description: action.description,
          dueDate: action.dueDate,
          priority: action.priority,
          status: action.status,
          createdAt: action.createdAt,
        });
      });
    }
  });

  if (allActions.length === 0) {
    alert("No actions to export");
    return null;
  }

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    statusOverrides: [],
    manualOpportunities: [],
    actionsComments: {
      actions: allActions,
    },
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  const filename =
    selectedOpportunities.length > 0 && !exportAll
      ? `actions_selected_${new Date().toISOString().split("T")[0]}.json`
      : `actions_all_${new Date().toISOString().split("T")[0]}.json`;
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return exportData;
};

/**
 * Import actions from JSON file
 */
export const importActionsComments = (file: File): Promise<Record<string, any>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target!.result as string);

        const results: { actions: { created: any[]; updated: any[]; skipped: any[] } } = {
          actions: { created: [], updated: [], skipped: [] },
        };

        const formatDate = (dateStr: string | null) => {
          if (!dateStr) return "-";
          return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
        };

        const actions = importData.actionsComments?.actions || [];
        actions.forEach((action: any) => {
          try {
            const ds = useUserDataStore.getState();
            let existingActions = [...(ds.opportunityActions[action.opportunityId] || [])];
            const existingIndex = existingActions.findIndex((a) => a.id === action.id);

            const importedData = {
              description: action.description || "-",
              owner: action.owner || "-",
              status: action.status || "-",
              priority: action.priority || "-",
              dueDate: formatDate(action.dueDate),
            };

            if (existingIndex >= 0) {
              const existingAction = existingActions[existingIndex];
              const existingData = {
                description: existingAction.description || "-",
                owner: existingAction.owner || "-",
                status: existingAction.status || "-",
                priority: existingAction.priority || "-",
                dueDate: formatDate(existingAction.dueDate),
              };

              const changes: string[] = [];
              if (existingAction.description !== action.description) changes.push("description");
              if (existingAction.owner !== action.owner) changes.push("owner");
              if (existingAction.status !== action.status) changes.push("status");
              if (existingAction.priority !== action.priority) changes.push("priority");
              if (existingAction.dueDate !== action.dueDate) changes.push("dueDate");

              if (changes.length > 0) {
                existingActions[existingIndex] = action;
                useUserDataStore.getState().setOpportunityActions(action.opportunityId, existingActions);
                results.actions.updated.push({
                  id: action.id,
                  opportunityId: action.opportunityId,
                  opportunityName: action.opportunityName || action.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "updated",
                  reason: `Updated: ${changes.join(", ")}`,
                  changes,
                });
              } else {
                results.actions.skipped.push({
                  id: action.id,
                  opportunityId: action.opportunityId,
                  opportunityName: action.opportunityName || action.opportunityId,
                  existing: existingData,
                  imported: importedData,
                  decision: "skipped",
                  reason: "No changes detected",
                  changes: [],
                });
              }
            } else {
              existingActions.push(action);
              useUserDataStore.getState().setOpportunityActions(action.opportunityId, existingActions);
              results.actions.created.push({
                id: action.id,
                opportunityId: action.opportunityId,
                opportunityName: action.opportunityName || action.opportunityId,
                existing: null,
                imported: importedData,
                decision: "created",
                reason: "New action",
                changes: [],
              });
            }
          } catch (e) {
            console.error("Error importing action:", e);
          }
        });

        resolve(results);
      } catch (e) {
        reject(new Error("Invalid JSON file. Please select a valid export file."));
      }
    };

    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsText(file);
  });
};
