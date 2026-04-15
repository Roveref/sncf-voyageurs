import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { OpportunityAction, StaffingNeedItem, RevenueTeamMember } from "../types";
import type { EmployeeMetadata } from "../components/StaffingTab/types";
import type { EditorState } from "../components/StaffingTab/components/Edit/bulkEditTypes";

// ── Types ──

export interface ManualAccount {
  account: string;
  isManual: true;
  createdAt: string;
  subSegmentCode?: string;
  subSegment?: string;
  country?: string;
  parentAccount?: string;
}

export interface ManualOpportunity {
  status: number;
  opportunityId: string;
  opportunity: string;
  account: string;
  bookingDate?: string | null;
  isManual?: boolean;
  grossRevenue?: number;
  netRevenue?: number;
  winPct?: number;
  cm1Pct?: number;
  engagementType?: string;
  estimatedBookingDate?: string;
  serviceLine1?: string;
  serviceOffering1?: string;
  subSegmentCode?: string;
  subSegment?: string;
  manager?: string;
  partner?: string;
  em?: string;
  ep?: string;
  creationDate?: string;
  lostComment?: string;
  // Index signature kept: manual opps merge with CRM Opportunity fields at runtime
  [key: string]: unknown;
}

// Re-export from standalone module for backward compatibility
export { STATUS_OPTIONS, updateStatusOptionsFromOptionSet } from "../utils/statusOptions";
export type { StatusOption } from "../utils/statusOptions";

export interface OverrideData {
  originalStatus: number;
  newStatus: number;
  comment: string;
  modifiedAt: string;
  bookingDate?: string;
  _reverted?: boolean;
}

export interface ManualEmployee {
  empId: string;
  name: string;
  grade?: string;
  subTeam?: string;
  serviceLine?: string;
  managerId?: string;
  arrivalDate?: string;
  departureDate?: string;
}

// ── Store shape ──
export interface UserDataState {
  // ── Status overrides ──
  statusOverrides: Record<string, OverrideData>;
  setStatusOverrides: (overrides: Record<string, OverrideData>) => void;
  setStatusOverride: (
    opportunityId: string,
    originalStatus: number,
    newStatus: number,
    comment?: string,
    bookingDate?: string | null
  ) => void;
  removeStatusOverride: (opportunityId: string) => void;
  clearAllStatusOverrides: () => void;
  mergeExcelOverrides: (excelOverrides: Record<string, OverrideData>) => void;

  // ── Manual opportunities ──
  manualOpportunities: ManualOpportunity[];
  setManualOpportunities: (opps: ManualOpportunity[]) => void;
  addManualOpportunity: (opp: ManualOpportunity) => void;
  updateManualOpportunity: (opportunityId: string, updates: Partial<ManualOpportunity>) => void;
  updateManualOpportunityStatus: (opportunityId: string, newStatus: number, bookingDate?: string | null) => void;
  deleteManualOpportunity: (opportunityId: string) => void;
  clearAllManualOpportunities: () => void;

  // ── Manual accounts ──
  manualAccounts: ManualAccount[];
  setManualAccounts: (accounts: ManualAccount[]) => void;
  addManualAccount: (newAccount: Omit<ManualAccount, "isManual" | "createdAt">) => void;
  deleteManualAccount: (accountName: string) => void;
  clearAllManualAccounts: () => void;

  // ── Opportunity actions, staffing needs ──
  opportunityActions: Record<string, OpportunityAction[]>;
  staffingNeeds: Record<string, StaffingNeedItem[]>;
  setOpportunityActions: (opportunityId: string, actions: OpportunityAction[]) => void;
  setStaffingNeeds: (opportunityId: string, needs: StaffingNeedItem[]) => void;
  deleteOpportunityData: (opportunityId: string) => void;
  setAllOpportunityActions: (all: Record<string, OpportunityAction[]>) => void;
  setAllStaffingNeeds: (all: Record<string, StaffingNeedItem[]>) => void;

  // ── Revenue team allocations ──
  revenueTeam: Record<string, RevenueTeamMember[]>;
  setRevenueTeam: (opportunityId: string, members: RevenueTeamMember[]) => void;
  setAllRevenueTeam: (all: Record<string, RevenueTeamMember[]>) => void;

  // ── Employee overrides ──
  employeeOverrides: Record<string, Partial<EmployeeMetadata>>;
  manualEmployees: ManualEmployee[];
  setOverrides: (overrides: Record<string, Partial<EmployeeMetadata>>) => void;
  upsertOverride: (empId: string, meta: Partial<EmployeeMetadata>) => void;
  deleteOverride: (empId: string) => void;
  setManualEmployees: (employees: ManualEmployee[]) => void;
  addManualEmployee: (employee: ManualEmployee) => void;
  removeManualEmployee: (empId: string) => void;

  // ── Editor states (MDS edits) ──
  editorStates: Record<string, EditorState | null>;
  setEditorStates: (states: Record<string, EditorState | null>) => void;
  setEditorState: (empId: string, state: EditorState | null) => void;
  clearEditorState: (empId: string) => void;
}

// ── Cascade delete helpers ──

// All fields that hold per-opportunity data (keyed by opportunityId)
const OPP_DATA_FIELDS = ["opportunityActions", "staffingNeeds", "revenueTeam", "statusOverrides"] as const;

/** Remove all data associated with given opportunityIds from the state. */
function cascadeDeleteOpportunities(state: UserDataState, idsToRemove: Set<string>): Partial<UserDataState> {
  const patch: Record<string, unknown> = {};
  for (const field of OPP_DATA_FIELDS) {
    const current = state[field] as Record<string, unknown>;
    const next = { ...current };
    let changed = false;
    for (const id of idsToRemove) {
      if (id in next) {
        delete next[id];
        changed = true;
      }
    }
    if (changed) patch[field] = next;
  }
  return patch;
}

export const useUserDataStore = create<UserDataState>()(
  devtools(
    (set, get) => ({
      // ══════════════════════════════════════════════════════════════════════════
      // ── Status overrides ──
      // ══════════════════════════════════════════════════════════════════════════
      statusOverrides: {},

      setStatusOverrides: (overrides) => {
        set({ statusOverrides: overrides });
      },

      setStatusOverride: (opportunityId, originalStatus, newStatus, comment = "", bookingDate = null) => {
        if (originalStatus === newStatus) {
          // Setting back to original -> revert (tombstone)
          get().removeStatusOverride(opportunityId);
          return;
        }
        set((s) => {
          const override: OverrideData = {
            originalStatus,
            newStatus,
            comment,
            modifiedAt: new Date().toISOString(),
          };
          if (newStatus === 14 || newStatus === 15) {
            override.bookingDate = bookingDate || new Date().toISOString().split("T")[0];
          }
          const next = { ...s.statusOverrides, [opportunityId]: override };
          return { statusOverrides: next };
        });
      },

      removeStatusOverride: (opportunityId) => {
        set((s) => {
          const next = { ...s.statusOverrides };
          delete next[opportunityId];
          return { statusOverrides: next };
        });
      },

      clearAllStatusOverrides: () => {
        set({ statusOverrides: {} });
      },

      mergeExcelOverrides: (excelOverrides) => {
        set((s) => {
          const merged = { ...s.statusOverrides };
          let changed = false;
          Object.entries(excelOverrides).forEach(([opportunityId, data]) => {
            if (!merged[opportunityId]) {
              merged[opportunityId] = data;
              changed = true;
            }
          });
          if (changed) {
            return { statusOverrides: merged };
          }
          return s;
        });
      },

      // ══════════════════════════════════════════════════════════════════════════
      // ── Manual opportunities ──
      // ══════════════════════════════════════════════════════════════════════════
      manualOpportunities: [],

      setManualOpportunities: (opps) => {
        set({ manualOpportunities: opps });
      },

      addManualOpportunity: (opp) => {
        set((s) => {
          if (s.manualOpportunities.some((o) => o.opportunityId === opp.opportunityId)) return s;
          const next = [...s.manualOpportunities, opp];
          return { manualOpportunities: next };
        });
      },

      updateManualOpportunity: (opportunityId, updates) => {
        if (!updates) return;
        set((s) => ({
          manualOpportunities: s.manualOpportunities.map((o) =>
            o.opportunityId === opportunityId ? { ...o, ...updates } : o
          ),
        }));
      },

      updateManualOpportunityStatus: (opportunityId, newStatus, bookingDate = null) => {
        set((s) => {
          const next = s.manualOpportunities.map((o) => {
            if (o.opportunityId !== opportunityId) return o;
            const updated = { ...o, status: newStatus };
            if (newStatus === 14 || newStatus === 15) {
              updated.bookingDate = bookingDate || new Date().toISOString().split("T")[0];
            } else {
              delete updated.bookingDate;
            }
            return updated;
          });
          return { manualOpportunities: next };
        });
      },

      deleteManualOpportunity: (opportunityId) => {
        set((s) => ({
          manualOpportunities: s.manualOpportunities.filter((o) => o.opportunityId !== opportunityId),
          ...cascadeDeleteOpportunities(s, new Set([opportunityId])),
        }));
      },

      clearAllManualOpportunities: () => {
        set({ manualOpportunities: [] });
      },

      // ══════════════════════════════════════════════════════════════════════════
      // ── Manual accounts ──
      // ══════════════════════════════════════════════════════════════════════════
      manualAccounts: [],

      setManualAccounts: (accounts) => {
        set({ manualAccounts: accounts });
      },

      addManualAccount: (newAccount) => {
        const accountWithMeta: ManualAccount = {
          ...newAccount,
          isManual: true,
          createdAt: new Date().toISOString(),
        };
        set((s) => {
          const updated = [...s.manualAccounts, accountWithMeta];
          return { manualAccounts: updated };
        });
      },

      deleteManualAccount: (accountName) => {
        set((s) => {
          const removedIds = new Set(
            s.manualOpportunities.filter((opp) => opp.account === accountName).map((opp) => opp.opportunityId)
          );
          return {
            manualAccounts: s.manualAccounts.filter((a) => a.account !== accountName),
            manualOpportunities: s.manualOpportunities.filter((opp) => opp.account !== accountName),
            ...cascadeDeleteOpportunities(s, removedIds),
          };
        });
      },

      clearAllManualAccounts: () => {
        const { manualAccounts, manualOpportunities } = get();
        const accNames = new Set(manualAccounts.map((a) => a.account));
        const remaining = manualOpportunities.filter((opp) => !accNames.has(opp.account));
        set({
          manualAccounts: [],
          ...(remaining.length !== manualOpportunities.length ? { manualOpportunities: remaining } : {}),
        });
      },

      // ══════════════════════════════════════════════════════════════════════════
      // ── Opportunity actions, staffing needs ──
      // ══════════════════════════════════════════════════════════════════════════
      opportunityActions: {},
      staffingNeeds: {},

      setOpportunityActions: (opportunityId, actions) => {
        set((s) => {
          const next = { ...s.opportunityActions, [opportunityId]: actions };
          if (actions.length === 0) delete next[opportunityId];
          return { opportunityActions: next };
        });
      },

      setStaffingNeeds: (opportunityId, needs) => {
        set((s) => {
          const next = { ...s.staffingNeeds, [opportunityId]: needs };
          if (needs.length === 0) delete next[opportunityId];
          return { staffingNeeds: next };
        });
      },

      deleteOpportunityData: (opportunityId) => {
        set((s) => {
          const { [opportunityId]: _a, ...restActions } = s.opportunityActions;
          const { [opportunityId]: _n, ...restNeeds } = s.staffingNeeds;
          const { [opportunityId]: _r, ...restTeam } = s.revenueTeam;
          return {
            opportunityActions: restActions,
            staffingNeeds: restNeeds,
            revenueTeam: restTeam,
          };
        });
      },

      setAllOpportunityActions: (all) => set({ opportunityActions: all }),
      setAllStaffingNeeds: (all) => set({ staffingNeeds: all }),

      // ══════════════════════════════════════════════════════════════════════════
      // ── Revenue team allocations ──
      // ══════════════════════════════════════════════════════════════════════════
      revenueTeam: {},

      setRevenueTeam: (opportunityId, members) => {
        set((s) => {
          const next = { ...s.revenueTeam, [opportunityId]: members };
          if (members.length === 0) delete next[opportunityId];
          return { revenueTeam: next };
        });
      },

      setAllRevenueTeam: (all) => set({ revenueTeam: all }),

      // ══════════════════════════════════════════════════════════════════════════
      // ── Employee overrides ──
      // ══════════════════════════════════════════════════════════════════════════
      employeeOverrides: {},
      manualEmployees: [],

      setOverrides: (overrides) => set({ employeeOverrides: overrides }),
      upsertOverride: (empId, meta) => {
        set((s) => ({
          employeeOverrides: {
            ...s.employeeOverrides,
            [empId]: { ...(s.employeeOverrides[empId] || {}), ...meta } as Partial<EmployeeMetadata>,
          },
        }));
      },
      deleteOverride: (empId) => {
        set((s) => {
          const next = { ...s.employeeOverrides };
          delete next[empId];
          return { employeeOverrides: next };
        });
      },
      setManualEmployees: (employees) => set({ manualEmployees: employees }),
      addManualEmployee: (employee) => {
        set((s) => {
          if (s.manualEmployees.some((m) => m.empId === employee.empId)) return s;
          return { manualEmployees: [...s.manualEmployees, employee] };
        });
      },
      removeManualEmployee: (empId) => {
        set((s) => ({ manualEmployees: s.manualEmployees.filter((m) => m.empId !== empId) }));
      },

      // ══════════════════════════════════════════════════════════════════════════
      // ── Editor states (MDS edits) ──
      // ══════════════════════════════════════════════════════════════════════════
      editorStates: {},

      setEditorStates: (states) => set({ editorStates: states }),
      setEditorState: (empId, state) => set((s) => ({ editorStates: { ...s.editorStates, [empId]: state } })),
      clearEditorState: (empId) =>
        set((s) => {
          const next = { ...s.editorStates };
          delete next[empId];
          return { editorStates: next };
        }),
    }),
    { name: "UserDataStore" }
  )
);
