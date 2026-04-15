import { create } from "zustand";
import { devtools } from "zustand/middleware";

// Re-export from split stores for backward compatibility
export { useThemeStore } from "./useThemeStore";
export { useLoadingStore } from "./useLoadingStore";
export type { NotificationSeverity, NotificationState, SyncStatus } from "./useLoadingStore";

// ── Store shape ──
export interface AppState {
  // Active hydration filter (region/country selected on landing page)
  hydrationFilter: { region?: string; country?: string } | null;
  setHydrationFilter: (f: { region?: string; country?: string } | null) => void;
  sinceYear: number | null;
  setSinceYear: (y: number | null) => void;

  // Live CRM changes tracking (SSE delta sync)
  liveChangedOppIds: Set<string>;
  liveRevenueDelta: number;
  liveFilterActive: boolean;
  addLiveChanges: (opportunityIds: string[], revenueDelta: number) => void;
  toggleLiveFilter: () => void;
  clearLiveChanges: () => void;

  // Filtered opportunity IDs (by region/sidebar filters) — used globally to scope staffing needs
  filteredOppIds: Set<string>;
  setFilteredOppIds: (ids: Set<string>) => void;

  // Notification-scoped IDs (sidebar filters only, no display toggles like showIO)
  notifFilteredOppIds: Set<string>;
  setNotifFilteredOppIds: (ids: Set<string>) => void;

  // Display toggles
  showNetRevenue: boolean;
  showIO: "off" | "show" | "ioOnly" | "ioTeam" | "ioLead";
  showLost: boolean;
  modificationsEnabled: "off" | "all" | "changes";
  toggleNetRevenue: () => void;
  toggleIO: () => void;
  toggleLost: () => void;
  setShowLost: (v: boolean) => void;
  setModificationsEnabled: (v: "off" | "all" | "changes") => void;

  // Cross-component signal: SSE notification received
  sseNotificationVersion: number;
  bumpSseNotification: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      // ── Hydration filter ──
      hydrationFilter: null,
      setHydrationFilter: (f) => set({ hydrationFilter: f }),
      sinceYear: 2022,
      setSinceYear: (y) => set({ sinceYear: y }),

      // ── Filtered opportunity IDs ──
      filteredOppIds: new Set(),
      setFilteredOppIds: (ids) => set({ filteredOppIds: ids }),
      notifFilteredOppIds: new Set(),
      setNotifFilteredOppIds: (ids) => set({ notifFilteredOppIds: ids }),

      // ── Live CRM changes ──
      liveChangedOppIds: new Set(),
      liveRevenueDelta: 0,
      liveFilterActive: false,
      addLiveChanges: (opportunityIds, revenueDelta) =>
        set((s) => {
          const next = new Set(s.liveChangedOppIds);
          for (const id of opportunityIds) next.add(id);
          return { liveChangedOppIds: next, liveRevenueDelta: s.liveRevenueDelta + revenueDelta };
        }),
      toggleLiveFilter: () => set((s) => ({ liveFilterActive: !s.liveFilterActive })),
      clearLiveChanges: () => set({ liveChangedOppIds: new Set(), liveRevenueDelta: 0, liveFilterActive: false }),

      // ── Display toggles ──
      showNetRevenue: true,
      showIO: "off",
      showLost: false,
      modificationsEnabled: "all",
      toggleNetRevenue: () => set((s) => ({ showNetRevenue: !s.showNetRevenue })),
      toggleIO: () => {
        const next: Record<string, "off" | "show" | "ioOnly" | "ioTeam" | "ioLead"> = {
          off: "show",
          show: "ioOnly",
          ioOnly: "ioTeam",
          ioTeam: "ioLead",
          ioLead: "off",
        };
        set((s) => ({ showIO: next[s.showIO] || "off" }));
      },
      toggleLost: () => set((s) => ({ showLost: !s.showLost })),
      setShowLost: (v) => set({ showLost: v }),
      setModificationsEnabled: (v) => set({ modificationsEnabled: v }),
      sseNotificationVersion: 0,
      bumpSseNotification: () => set((s) => ({ sseNotificationVersion: s.sseNotificationVersion + 1 })),
    }),
    { name: "AppStore" }
  )
);
