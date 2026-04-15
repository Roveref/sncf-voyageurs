/**
 * useDashboardLayoutStore — Persists the custom dashboard grid layout.
 *
 * Each cell has: widgetKey (which card), column span, row span.
 * Layout is saved to localStorage.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface DashboardWidget {
  id: string; // unique placement id
  widgetKey: string; // card identifier (e.g. "tu-overview", "pipeline-insights")
  col: number; // grid column start (0-based)
  row: number; // grid row start (0-based)
  colSpan: number; // columns spanned (1-4)
  rowSpan: number; // rows spanned (1-3)
}

interface DashboardLayoutState {
  widgets: DashboardWidget[];
  columns: number;
  addWidget: (widgetKey: string, col: number, row: number) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, col: number, row: number) => void;
  resizeWidget: (id: string, colSpan: number, rowSpan: number) => void;
  setWidgets: (widgets: DashboardWidget[]) => void;
}

const LS_KEY = "custom_dashboard_layout";

const loadLayout = (): DashboardWidget[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
};

const persist = (widgets: DashboardWidget[]) => {
  localStorage.setItem(LS_KEY, JSON.stringify(widgets));
};

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  devtools(
    (set, get) => ({
      widgets: loadLayout(),
      columns: 4,

      addWidget: (widgetKey, col, row) => {
        const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
        const widgets = [...get().widgets, { id, widgetKey, col, row, colSpan: 2, rowSpan: 1 }];
        persist(widgets);
        set({ widgets });
      },

      removeWidget: (id) => {
        const widgets = get().widgets.filter((w) => w.id !== id);
        persist(widgets);
        set({ widgets });
      },

      moveWidget: (id, col, row) => {
        const widgets = get().widgets.map((w) => (w.id === id ? { ...w, col, row } : w));
        persist(widgets);
        set({ widgets });
      },

      resizeWidget: (id, colSpan, rowSpan) => {
        const widgets = get().widgets.map((w) =>
          w.id === id
            ? { ...w, colSpan: Math.max(1, Math.min(4, colSpan)), rowSpan: Math.max(1, Math.min(3, rowSpan)) }
            : w
        );
        persist(widgets);
        set({ widgets });
      },

      setWidgets: (widgets) => {
        persist(widgets);
        set({ widgets });
      },
    }),
    { name: "DashboardLayoutStore" }
  )
);
