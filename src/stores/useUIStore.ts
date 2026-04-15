import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Opportunity } from "../types/opportunity";

export interface UIState {
  // Sidebar collapsed state
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;

  // Modals
  createModalOpen: boolean;
  createAccountModalOpen: boolean;
  createStaffingNeedModalOpen: boolean;
  staffingNeedOpportunity: Opportunity | null;
  staffingNeedsDrawerOpen: boolean;
  /** Cross-component signal: open BulkEditPanel for an employee with prefilled assignment */
  bulkEditPrefill: {
    empId: string;
    jobNo?: string;
    jobName?: string;
    startDate?: string;
    endDate?: string;
    utilization?: number;
    needId?: string;
  } | null;
  pendingStaffingFilter: { text: string; type: string } | null;
  fabOpen: boolean;

  // Edit state
  editOpportunity: Opportunity | null;
  navigateToOpportunityId: string | null;

  // Sidebar expansions
  expandedGroups: Record<string, boolean>;
  expandedSegmentGroups: Record<string, boolean>;
  expandedSegmentCodes: Record<string, boolean>;
  expandedServiceLines: Record<string, boolean>;

  // Selection
  selectedOpportunities: Opportunity[];

  // Actions
  setCreateModalOpen: (v: boolean) => void;
  setCreateAccountModalOpen: (v: boolean) => void;
  setCreateStaffingNeedModalOpen: (v: boolean) => void;
  setStaffingNeedOpportunity: (opp: Opportunity | null) => void;
  setStaffingNeedsDrawerOpen: (v: boolean) => void;
  setBulkEditPrefill: (
    v: {
      empId: string;
      jobNo?: string;
      jobName?: string;
      startDate?: string;
      endDate?: string;
      utilization?: number;
      needId?: string;
    } | null
  ) => void;
  setPendingStaffingFilter: (f: { text: string; type: string } | null) => void;
  setFabOpen: (v: boolean) => void;
  setEditOpportunity: (opp: Opportunity | null) => void;
  setNavigateToOpportunityId: (id: string | null) => void;
  setExpandedGroups: (
    v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  setExpandedSegmentGroups: (
    v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  setExpandedSegmentCodes: (
    v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  setExpandedServiceLines: (
    v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => void;
  setSelectedOpportunities: (opps: Opportunity[]) => void;

  // Compound actions
  navigateToOpportunity: (opportunityId: string, newStatus?: number | null) => void;

  // Cross-component signals (replace CustomEvents)
  staffingDebugToggleVersion: number;
  toggleStaffingDebug: () => void;
  lastAiAction: { action: string; data?: unknown } | null;
  setLastAiAction: (action: { action: string; data?: unknown } | null) => void;
}

// Module-level timers for navigateToOpportunity (avoids race conditions)
let _navSetTimer: ReturnType<typeof setTimeout> | null = null;
let _navClearTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      // ── Sidebar collapsed state ──
      leftSidebarOpen: typeof window !== "undefined" ? localStorage.getItem("leftSidebarOpen") !== "false" : true,
      rightSidebarOpen: typeof window !== "undefined" ? localStorage.getItem("rightSidebarOpen") !== "false" : true,
      toggleLeftSidebar: () =>
        set((s) => {
          const next = !s.leftSidebarOpen;
          localStorage.setItem("leftSidebarOpen", String(next));
          return { leftSidebarOpen: next };
        }),
      toggleRightSidebar: () =>
        set((s) => {
          const next = !s.rightSidebarOpen;
          localStorage.setItem("rightSidebarOpen", String(next));
          return { rightSidebarOpen: next };
        }),

      // ── Modals ──
      createModalOpen: false,
      createAccountModalOpen: false,
      createStaffingNeedModalOpen: false,
      staffingNeedOpportunity: null,
      staffingNeedsDrawerOpen: false,
      bulkEditPrefill: null,
      pendingStaffingFilter: null,
      fabOpen: false,

      // ── Edit state ──
      editOpportunity: null,
      navigateToOpportunityId: null,

      // ── Sidebar expansions ──
      expandedGroups: { BTU: false, ETU: false, Products: false, Arcwide: false },
      expandedSegmentGroups: { AMD: false },
      expandedSegmentCodes: {},
      expandedServiceLines: {},

      // ── Selection ──
      selectedOpportunities: [],

      // ── Actions ──
      setCreateModalOpen: (v) => set({ createModalOpen: v }),
      setCreateAccountModalOpen: (v) => set({ createAccountModalOpen: v }),
      setCreateStaffingNeedModalOpen: (v) => set({ createStaffingNeedModalOpen: v }),
      setStaffingNeedOpportunity: (opp) => set({ staffingNeedOpportunity: opp }),
      setStaffingNeedsDrawerOpen: (v) => set({ staffingNeedsDrawerOpen: v }),
      setBulkEditPrefill: (v) => set({ bulkEditPrefill: v }),
      setPendingStaffingFilter: (f) => set({ pendingStaffingFilter: f }),
      setFabOpen: (v) => set({ fabOpen: v }),
      setEditOpportunity: (opp) => {
        set({ editOpportunity: opp, ...(opp ? { createModalOpen: true } : {}) });
      },
      setNavigateToOpportunityId: (id) => set({ navigateToOpportunityId: id }),
      setExpandedGroups: (v) =>
        set((s) => ({
          expandedGroups: typeof v === "function" ? v(s.expandedGroups) : v,
        })),
      setExpandedSegmentGroups: (v) =>
        set((s) => ({
          expandedSegmentGroups: typeof v === "function" ? v(s.expandedSegmentGroups) : v,
        })),
      setExpandedSegmentCodes: (v) =>
        set((s) => ({
          expandedSegmentCodes: typeof v === "function" ? v(s.expandedSegmentCodes) : v,
        })),
      setExpandedServiceLines: (v) =>
        set((s) => ({
          expandedServiceLines: typeof v === "function" ? v(s.expandedServiceLines) : v,
        })),
      setSelectedOpportunities: (opps) => set({ selectedOpportunities: opps }),

      // ── Compound actions ──
      navigateToOpportunity: (opportunityId, newStatus = null) => {
        // Note: Tab navigation is handled externally via useTabRouting
        // This just sets the navigateToOpportunityId with auto-clear
        if (_navSetTimer) clearTimeout(_navSetTimer);
        if (_navClearTimer) clearTimeout(_navClearTimer);
        _navSetTimer = setTimeout(() => {
          set({ navigateToOpportunityId: opportunityId });
          _navClearTimer = setTimeout(() => set({ navigateToOpportunityId: null }), 1000);
        }, 100);
      },

      // ── Cross-component signals ──
      staffingDebugToggleVersion: 0,
      toggleStaffingDebug: () => set((s) => ({ staffingDebugToggleVersion: s.staffingDebugToggleVersion + 1 })),
      lastAiAction: null,
      setLastAiAction: (action) => set({ lastAiAction: action }),
    }),
    { name: "UIStore" }
  )
);
