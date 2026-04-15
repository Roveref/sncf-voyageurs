/**
 * ManagementDialogContext — Shared state for tab components inside ManagementDialog.
 * Only contains state used by 3+ tabs to avoid over-contexting.
 */

import { createContext, useContext } from "react";

interface ManagementDialogContextValue {
  // Search
  searchText: string;
  // Selection
  selectedItems: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: (ids: string[]) => void;
  handleDeleteSelected: () => void;
  // Group collapse
  groupBy: string;
  isGroupCollapsed: (key: string) => boolean;
  toggleGroupCollapse: (key: string) => void;
  // Opportunity helpers (used by 4 tabs)
  handleOpenOpportunityPopup: (opp: any, initialActionsTab?: any) => void;
  opportunityMap: any;
}

const ManagementDialogContext = createContext<ManagementDialogContextValue | null>(null);

export const ManagementDialogProvider = ManagementDialogContext.Provider;

export const useManagementDialog = () => {
  const ctx = useContext(ManagementDialogContext);
  if (!ctx) throw new Error("useManagementDialog must be used within ManagementDialogProvider");
  return ctx;
};
