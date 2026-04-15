import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { CalendarDay, DailyCell, Employee } from "../components/StaffingTab/types";

// ── Hydrated skills data (used by useSkillsData facade hook) ──
export interface HydratedSkillsData {
  skills: Map<string, import("../components/StaffingTab/types").EmployeeSkills>;
  catalog: {
    allSkills: string[];
    categories: Record<string, string>;
    skillIndex: Map<string, Set<string>>;
  };
  totalEmployees: number;
  totalSkills: number;
}

// ── Store shape ──
export interface ComputedState {
  // Staffing
  staffingEmployees: Employee[];

  // Daily grid (populated by StaffingTab, used by NeedsBoardV2 for supply calc)
  dailyGrid: Map<string, DailyCell[]> | null;
  timelineCalendar: CalendarDay[] | null;
  calendarIndex: Map<string, number> | null;

  // Setters
  setStaffingEmployees: (employees: Employee[]) => void;
  setDailyGrid: (grid: Map<string, DailyCell[]>, calendar: CalendarDay[], calIndex: Map<string, number>) => void;

  // Skills catalog (for autocomplete, loaded from backend)
  skillsCatalog: { name: string; category: string | null; usageCount: number }[];
  setSkillsCatalog: (skills: { name: string; category: string | null; usageCount: number }[]) => void;

  // Enriched employees from server (replaces client-side useDataPipeline)
  enrichedEmployees: Employee[] | null;
  enrichedManagerList: any[] | null;
  setEnrichedEmployees: (employees: Employee[]) => void;
  setEnrichedManagerList: (list: any[]) => void;

  // Cross-component signal: staffing index rebuilt (replaces CustomEvent 'staffingIndexChanged')
  staffingIndexVersion: number;
  bumpStaffingIndex: () => void;
}

export const useComputedStore = create<ComputedState>()(
  devtools(
    (set) => ({
      // ── Staffing ──
      staffingEmployees: [],
      dailyGrid: null,
      timelineCalendar: null,
      calendarIndex: null,

      // ── Setters ──
      setStaffingEmployees: (employees) => set({ staffingEmployees: employees }),
      setDailyGrid: (grid, calendar, calIndex) =>
        set({ dailyGrid: grid, timelineCalendar: calendar, calendarIndex: calIndex }),
      skillsCatalog: [],
      setSkillsCatalog: (skills) => set({ skillsCatalog: skills }),
      enrichedEmployees: null,
      enrichedManagerList: null,
      setEnrichedEmployees: (employees) => set({ enrichedEmployees: employees }),
      setEnrichedManagerList: (list) => set({ enrichedManagerList: list }),
      staffingIndexVersion: 0,
      bumpStaffingIndex: () => set((s) => ({ staffingIndexVersion: s.staffingIndexVersion + 1 })),
    }),
    { name: "ComputedStore" }
  )
);
