/**
 * Widget catalog for Custom Dashboard — reads from the global widget registry.
 * Each DetachableCard auto-registers itself, so this catalog is always up-to-date
 * with the real components and their real data.
 */

import { useMemo } from "react";
import { useWidgetRegistry } from "../../stores/useWidgetRegistry";
import type { WidgetDef } from "./CustomDashboard";

/**
 * Hook that returns the widget catalog built from the registry.
 * The catalog updates whenever a DetachableCard mounts/unmounts.
 */
export function useWidgetCatalog(): WidgetDef[] {
  const widgets = useWidgetRegistry((s) => s.widgets);

  return useMemo(() => {
    const catalog: WidgetDef[] = [];
    for (const [key, entry] of widgets) {
      catalog.push({
        key,
        label: entry.label,
        group: entry.group,
        description: entry.label,
        defaultColSpan: 2,
        defaultRowSpan: 1,
        render: entry.render,
      });
    }
    return catalog;
  }, [widgets]);
}
