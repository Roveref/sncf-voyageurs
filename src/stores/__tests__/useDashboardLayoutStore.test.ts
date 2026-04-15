import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDashboardLayoutStore } from "../useDashboardLayoutStore";

describe("useDashboardLayoutStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useDashboardLayoutStore.setState({ widgets: [] });
  });

  // ── addWidget ──

  describe("addWidget", () => {
    it("creates a widget with a unique ID", () => {
      useDashboardLayoutStore.getState().addWidget("tu-overview", 0, 0);
      const widgets = useDashboardLayoutStore.getState().widgets;
      expect(widgets).toHaveLength(1);
      expect(widgets[0].widgetKey).toBe("tu-overview");
      expect(widgets[0].col).toBe(0);
      expect(widgets[0].row).toBe(0);
      expect(widgets[0].id).toMatch(/^w_/);
    });

    it("defaults to colSpan=2, rowSpan=1", () => {
      useDashboardLayoutStore.getState().addWidget("pipeline-insights", 1, 2);
      const w = useDashboardLayoutStore.getState().widgets[0];
      expect(w.colSpan).toBe(2);
      expect(w.rowSpan).toBe(1);
    });

    it("generates unique IDs for multiple widgets", () => {
      useDashboardLayoutStore.getState().addWidget("a", 0, 0);
      useDashboardLayoutStore.getState().addWidget("b", 1, 0);
      const widgets = useDashboardLayoutStore.getState().widgets;
      expect(widgets).toHaveLength(2);
      expect(widgets[0].id).not.toBe(widgets[1].id);
    });
  });

  // ── removeWidget ──

  describe("removeWidget", () => {
    it("removes a widget by ID", () => {
      useDashboardLayoutStore.getState().addWidget("card-a", 0, 0);
      useDashboardLayoutStore.getState().addWidget("card-b", 1, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().removeWidget(id);

      const widgets = useDashboardLayoutStore.getState().widgets;
      expect(widgets).toHaveLength(1);
      expect(widgets[0].widgetKey).toBe("card-b");
    });

    it("does nothing for non-existent ID", () => {
      useDashboardLayoutStore.getState().addWidget("card-a", 0, 0);
      useDashboardLayoutStore.getState().removeWidget("fake-id");
      expect(useDashboardLayoutStore.getState().widgets).toHaveLength(1);
    });
  });

  // ── moveWidget ──

  describe("moveWidget", () => {
    it("updates col and row", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().moveWidget(id, 3, 2);

      const w = useDashboardLayoutStore.getState().widgets[0];
      expect(w.col).toBe(3);
      expect(w.row).toBe(2);
    });

    it("preserves span values when moving", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().moveWidget(id, 2, 1);

      const w = useDashboardLayoutStore.getState().widgets[0];
      expect(w.colSpan).toBe(2);
      expect(w.rowSpan).toBe(1);
    });
  });

  // ── resizeWidget ──

  describe("resizeWidget", () => {
    it("sets colSpan and rowSpan within valid range", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().resizeWidget(id, 3, 2);

      const w = useDashboardLayoutStore.getState().widgets[0];
      expect(w.colSpan).toBe(3);
      expect(w.rowSpan).toBe(2);
    });

    it("clamps colSpan to maximum 4", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().resizeWidget(id, 10, 1);
      expect(useDashboardLayoutStore.getState().widgets[0].colSpan).toBe(4);
    });

    it("clamps colSpan to minimum 1", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().resizeWidget(id, 0, 1);
      expect(useDashboardLayoutStore.getState().widgets[0].colSpan).toBe(1);
    });

    it("clamps rowSpan to maximum 3", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().resizeWidget(id, 1, 99);
      expect(useDashboardLayoutStore.getState().widgets[0].rowSpan).toBe(3);
    });

    it("clamps rowSpan to minimum 1", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().resizeWidget(id, 1, -5);
      expect(useDashboardLayoutStore.getState().widgets[0].rowSpan).toBe(1);
    });
  });

  // ── Persistence ──

  describe("localStorage persistence", () => {
    it("persists on addWidget", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const stored = JSON.parse(localStorage.getItem("custom_dashboard_layout")!);
      expect(stored).toHaveLength(1);
      expect(stored[0].widgetKey).toBe("card");
    });

    it("persists on removeWidget", () => {
      useDashboardLayoutStore.getState().addWidget("card-a", 0, 0);
      useDashboardLayoutStore.getState().addWidget("card-b", 1, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().removeWidget(id);

      const stored = JSON.parse(localStorage.getItem("custom_dashboard_layout")!);
      expect(stored).toHaveLength(1);
    });

    it("persists on moveWidget", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().moveWidget(id, 2, 3);

      const stored = JSON.parse(localStorage.getItem("custom_dashboard_layout")!);
      expect(stored[0].col).toBe(2);
      expect(stored[0].row).toBe(3);
    });

    it("persists on resizeWidget", () => {
      useDashboardLayoutStore.getState().addWidget("card", 0, 0);
      const id = useDashboardLayoutStore.getState().widgets[0].id;

      useDashboardLayoutStore.getState().resizeWidget(id, 4, 3);

      const stored = JSON.parse(localStorage.getItem("custom_dashboard_layout")!);
      expect(stored[0].colSpan).toBe(4);
      expect(stored[0].rowSpan).toBe(3);
    });

    it("persists on setWidgets", () => {
      useDashboardLayoutStore
        .getState()
        .setWidgets([{ id: "w1", widgetKey: "test", col: 0, row: 0, colSpan: 1, rowSpan: 1 }]);
      const stored = JSON.parse(localStorage.getItem("custom_dashboard_layout")!);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("w1");
    });
  });
});
