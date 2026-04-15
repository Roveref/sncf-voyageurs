import { create } from "zustand";
import { devtools } from "zustand/middleware";

// ── Notification types ──
export type NotificationSeverity = "info" | "success" | "warning" | "error";
export interface NotificationState {
  open: boolean;
  message: string;
  severity: NotificationSeverity;
}

// ── Sync status (auto-save indicator) ──
export type SyncStatus = "idle" | "saving" | "saved" | "error";

// ── Store shape ──
export interface LoadingState {
  // Loading / progress
  loading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  setLoading: (v: boolean) => void;
  setLoadingProgress: (v: number) => void;
  setLoadingMessage: (v: string) => void;

  // Sync status (auto-save to backend)
  syncStatus: SyncStatus;
  lastSavedAt: number | null;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSavedAt: (ts: number | null) => void;

  // Notification
  notification: NotificationState;
  setNotification: (n: NotificationState) => void;
  notify: (message: string, severity?: NotificationSeverity) => void;
  closeNotification: () => void;
}

export const useLoadingStore = create<LoadingState>()(
  devtools(
    (set) => ({
      // ── Loading / progress ──
      loading: false,
      loadingProgress: 0,
      loadingMessage: "",
      setLoading: (v) => set({ loading: v }),
      setLoadingProgress: (v) => set({ loadingProgress: v }),
      setLoadingMessage: (v) => set({ loadingMessage: v }),

      // ── Sync status ──
      syncStatus: "idle",
      lastSavedAt: null,
      setSyncStatus: (status) => set({ syncStatus: status }),
      setLastSavedAt: (ts) => set({ lastSavedAt: ts }),

      // ── Notification ──
      notification: { open: false, message: "", severity: "info" as NotificationSeverity },
      setNotification: (n) => set({ notification: n }),
      notify: (message, severity = "info") => set({ notification: { open: true, message, severity } }),
      closeNotification: () => set((s) => ({ notification: { ...s.notification, open: false } })),
    }),
    { name: "LoadingStore" }
  )
);
