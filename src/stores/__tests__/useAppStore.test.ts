import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "../useAppStore";
import { useThemeStore } from "../useThemeStore";
import { useLoadingStore } from "../useLoadingStore";
import useScenarioStore from "../useScenarioStore";
import { useUserDataStore } from "../useUserDataStore";
import { deleteScenarioWithCleanup } from "../helpers";

// ─── useThemeStore ───────────────────────────────────────────────

describe("useThemeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ darkMode: false });
  });

  it("defaults to false when localStorage is empty", () => {
    expect(useThemeStore.getState().darkMode).toBe(false);
  });

  it("reads initial value from localStorage", () => {
    // Simulate a page load where localStorage already has darkMode = true
    localStorage.setItem("darkMode", "true");
    // Re-create behaviour: the store reads at creation time; we simulate by setState
    useThemeStore.setState({ darkMode: localStorage.getItem("darkMode") === "true" });
    expect(useThemeStore.getState().darkMode).toBe(true);
  });

  it("toggleDarkMode flips to true and persists", () => {
    useThemeStore.getState().toggleDarkMode();
    expect(useThemeStore.getState().darkMode).toBe(true);
    expect(localStorage.getItem("darkMode")).toBe("true");
  });

  it("toggleDarkMode round-trips (true → false)", () => {
    useThemeStore.getState().toggleDarkMode(); // false → true
    useThemeStore.getState().toggleDarkMode(); // true → false
    expect(useThemeStore.getState().darkMode).toBe(false);
    expect(localStorage.getItem("darkMode")).toBe("false");
  });
});

// ─── useLoadingStore ─────────────────────────────────────────────

describe("useLoadingStore", () => {
  beforeEach(() => {
    useLoadingStore.setState({
      loading: false,
      loadingProgress: 0,
      loadingMessage: "",
      syncStatus: "idle",
      lastSavedAt: null,
      notification: { open: false, message: "", severity: "info" },
    });
  });

  describe("setSyncStatus", () => {
    it("changes from idle to saving", () => {
      useLoadingStore.getState().setSyncStatus("saving");
      expect(useLoadingStore.getState().syncStatus).toBe("saving");
    });

    it("changes from saving to saved", () => {
      useLoadingStore.getState().setSyncStatus("saving");
      useLoadingStore.getState().setSyncStatus("saved");
      expect(useLoadingStore.getState().syncStatus).toBe("saved");
    });

    it("changes to error", () => {
      useLoadingStore.getState().setSyncStatus("error");
      expect(useLoadingStore.getState().syncStatus).toBe("error");
    });
  });

  describe("notify", () => {
    it("creates a notification with default severity (info)", () => {
      useLoadingStore.getState().notify("Data loaded");
      const n = useLoadingStore.getState().notification;
      expect(n.open).toBe(true);
      expect(n.message).toBe("Data loaded");
      expect(n.severity).toBe("info");
    });

    it("creates a notification with explicit severity", () => {
      useLoadingStore.getState().notify("Save failed", "error");
      const n = useLoadingStore.getState().notification;
      expect(n.open).toBe(true);
      expect(n.message).toBe("Save failed");
      expect(n.severity).toBe("error");
    });

    it("creates warning notification", () => {
      useLoadingStore.getState().notify("Stale data", "warning");
      expect(useLoadingStore.getState().notification.severity).toBe("warning");
    });

    it("creates success notification", () => {
      useLoadingStore.getState().notify("Saved!", "success");
      expect(useLoadingStore.getState().notification.severity).toBe("success");
    });
  });

  describe("closeNotification", () => {
    it("sets open to false while preserving message and severity", () => {
      useLoadingStore.getState().notify("Hello", "warning");
      useLoadingStore.getState().closeNotification();
      const n = useLoadingStore.getState().notification;
      expect(n.open).toBe(false);
      expect(n.message).toBe("Hello");
      expect(n.severity).toBe("warning");
    });
  });
});

// ─── useAppStore ─────────────────────────────────────────────────

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      showIO: "off",
      showLost: false,
      showNetRevenue: true,
      modificationsEnabled: "all",
      liveChangedOppIds: new Set(),
      liveRevenueDelta: 0,
      liveFilterActive: false,
      sseNotificationVersion: 0,
    });
  });

  describe("toggleIO", () => {
    it("cycles through all 5 values: off → show → ioOnly → ioTeam → ioLead → off", () => {
      const { getState } = useAppStore;

      expect(getState().showIO).toBe("off");

      getState().toggleIO();
      expect(getState().showIO).toBe("show");

      getState().toggleIO();
      expect(getState().showIO).toBe("ioOnly");

      getState().toggleIO();
      expect(getState().showIO).toBe("ioTeam");

      getState().toggleIO();
      expect(getState().showIO).toBe("ioLead");

      getState().toggleIO();
      expect(getState().showIO).toBe("off");
    });
  });

  describe("toggleLost", () => {
    it("flips false → true", () => {
      useAppStore.getState().toggleLost();
      expect(useAppStore.getState().showLost).toBe(true);
    });

    it("flips true → false", () => {
      useAppStore.setState({ showLost: true });
      useAppStore.getState().toggleLost();
      expect(useAppStore.getState().showLost).toBe(false);
    });
  });

  describe("toggleNetRevenue", () => {
    it("flips true → false", () => {
      useAppStore.getState().toggleNetRevenue();
      expect(useAppStore.getState().showNetRevenue).toBe(false);
    });

    it("flips false → true", () => {
      useAppStore.setState({ showNetRevenue: false });
      useAppStore.getState().toggleNetRevenue();
      expect(useAppStore.getState().showNetRevenue).toBe(true);
    });
  });

  describe("setModificationsEnabled", () => {
    it("accepts 'off'", () => {
      useAppStore.getState().setModificationsEnabled("off");
      expect(useAppStore.getState().modificationsEnabled).toBe("off");
    });

    it("accepts 'all'", () => {
      useAppStore.getState().setModificationsEnabled("all");
      expect(useAppStore.getState().modificationsEnabled).toBe("all");
    });

    it("accepts 'changes'", () => {
      useAppStore.getState().setModificationsEnabled("changes");
      expect(useAppStore.getState().modificationsEnabled).toBe("changes");
    });
  });

  describe("addLiveChanges", () => {
    it("accumulates opportunity IDs", () => {
      useAppStore.getState().addLiveChanges(["opp1", "opp2"], 100);
      useAppStore.getState().addLiveChanges(["opp3"], 50);

      const s = useAppStore.getState();
      expect(s.liveChangedOppIds.size).toBe(3);
      expect(s.liveChangedOppIds.has("opp1")).toBe(true);
      expect(s.liveChangedOppIds.has("opp2")).toBe(true);
      expect(s.liveChangedOppIds.has("opp3")).toBe(true);
    });

    it("accumulates revenue delta", () => {
      useAppStore.getState().addLiveChanges(["opp1"], 100);
      useAppStore.getState().addLiveChanges(["opp2"], -30);
      expect(useAppStore.getState().liveRevenueDelta).toBe(70);
    });

    it("deduplicates opportunity IDs", () => {
      useAppStore.getState().addLiveChanges(["opp1"], 100);
      useAppStore.getState().addLiveChanges(["opp1"], 50);
      expect(useAppStore.getState().liveChangedOppIds.size).toBe(1);
      expect(useAppStore.getState().liveRevenueDelta).toBe(150);
    });
  });

  describe("clearLiveChanges", () => {
    it("resets IDs, delta, and filter", () => {
      useAppStore.getState().addLiveChanges(["opp1", "opp2"], 200);
      useAppStore.setState({ liveFilterActive: true });
      useAppStore.getState().clearLiveChanges();

      const s = useAppStore.getState();
      expect(s.liveChangedOppIds.size).toBe(0);
      expect(s.liveRevenueDelta).toBe(0);
      expect(s.liveFilterActive).toBe(false);
    });
  });

  describe("bumpSseNotification", () => {
    it("increments counter", () => {
      expect(useAppStore.getState().sseNotificationVersion).toBe(0);
      useAppStore.getState().bumpSseNotification();
      expect(useAppStore.getState().sseNotificationVersion).toBe(1);
      useAppStore.getState().bumpSseNotification();
      expect(useAppStore.getState().sseNotificationVersion).toBe(2);
    });
  });
});

// ─── deleteScenarioWithCleanup ───────────────────────────────────

describe("deleteScenarioWithCleanup", () => {
  beforeEach(() => {
    useScenarioStore.setState({ scenarios: [], activeScenarioId: null });
    useUserDataStore.setState({ editorStates: {} });
  });

  it("deleting active scenario clears editorStates", () => {
    const id = useScenarioStore.getState().createScenario("Active");
    expect(useScenarioStore.getState().activeScenarioId).toBe(id);

    // Simulate some editor states
    useUserDataStore.setState({ editorStates: { emp1: { dirty: true } as any, emp2: { dirty: false } as any } });

    deleteScenarioWithCleanup(id);

    expect(useScenarioStore.getState().scenarios).toHaveLength(0);
    expect(useScenarioStore.getState().activeScenarioId).toBeNull();
    expect(useUserDataStore.getState().editorStates).toEqual({});
  });

  it("deleting non-active scenario preserves editorStates", () => {
    const id1 = useScenarioStore.getState().createScenario("First");
    const id2 = useScenarioStore.getState().createScenario("Second"); // this becomes active
    expect(useScenarioStore.getState().activeScenarioId).toBe(id2);

    useUserDataStore.setState({ editorStates: { emp1: { dirty: true } as any } });

    // Delete the non-active scenario
    deleteScenarioWithCleanup(id1);

    expect(useScenarioStore.getState().scenarios).toHaveLength(1);
    expect(useScenarioStore.getState().activeScenarioId).toBe(id2);
    expect(useUserDataStore.getState().editorStates).toEqual({ emp1: { dirty: true } });
  });
});
