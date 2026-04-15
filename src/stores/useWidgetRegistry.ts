/**
 * useWidgetRegistry — Global registry of detachable card render functions.
 *
 * Each DetachableCard registers itself here with a key + render function.
 * The Custom Dashboard reads from this registry to render real components
 * with real data — no prop re-creation needed.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ReactNode } from "react";

interface WidgetEntry {
  key: string;
  label: string;
  group: string;
  render: () => ReactNode;
}

interface WidgetRegistryState {
  widgets: Map<string, WidgetEntry>;
  register: (key: string, label: string, group: string, render: () => ReactNode) => void;
  unregister: (key: string) => void;
}

export const useWidgetRegistry = create<WidgetRegistryState>()(
  devtools(
    (set) => ({
      widgets: new Map(),
      register: (key, label, group, render) =>
        set((s) => {
          const next = new Map(s.widgets);
          next.set(key, { key, label, group, render });
          return { widgets: next };
        }),
      unregister: (key) =>
        set((s) => {
          const next = new Map(s.widgets);
          next.delete(key);
          return { widgets: next };
        }),
    }),
    { name: "WidgetRegistry" }
  )
);
