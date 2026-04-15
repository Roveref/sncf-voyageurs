import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "react";
import { useFilterStore, type FilterState } from "../useFilterStore";
import { initializeFilters, type Filters, type FilterValue } from "../../utils/filterHelpers";
// useCrmStore removed — CRM data now lives in React Query cache

// ── Mock startTransition to execute synchronously in tests ────────────────
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    startTransition: (fn: () => void) => fn(),
  };
});

// ── Test data ─────────────────────────────────────────────────────────────

const SEGMENT_TO_SUB_SEGMENT: Record<string, string[]> = {
  FS: ["FS-Banking", "FS-Insurance", "FS-AssetMgmt"],
  PS: ["PS-Telco", "PS-Media"],
  EN: ["EN-Oil", "EN-Gas", "EN-Renewables"],
};

const SERVICE_TO_OFFERING: Record<string, string[]> = {
  Consulting: ["Consulting::Strategy", "Consulting::Operations"],
  Technology: ["Technology::Cloud", "Technology::Data", "Technology::AI"],
  Analytics: ["Analytics::BI", "Analytics::DataScience"],
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getState(): FilterState {
  return useFilterStore.getState();
}

function getFilters(): Filters {
  return getState().filters;
}

function included(fv: FilterValue): string[] {
  return fv.included;
}

function excluded(fv: FilterValue): string[] {
  return fv.excluded;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("useFilterStore", () => {
  beforeEach(() => {
    useFilterStore.setState({
      filters: initializeFilters(),
      segmentModes: new Map(),
      serviceLineModes: new Map(),
    });
  });

  // ── 1. Initialization ──

  describe("initializeFilters", () => {
    it("returns all filter keys with empty included/excluded arrays", () => {
      const filters = getFilters();
      const keys: (keyof Filters)[] = [
        "subSegmentCodes",
        "subSegments",
        "serviceLine1",
        "serviceOfferings",
        "accounts",
        "status",
        "people",
        "technologyPartners",
        "macroGrades",
        "macroCategories",
      ];
      keys.forEach((key) => {
        expect(filters[key]).toEqual({ included: [], excluded: [] });
      });
    });

    it("returns a fresh object each time (no shared references)", () => {
      const a = initializeFilters();
      const b = initializeFilters();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.status).not.toBe(b.status);
    });
  });

  // ── 2. handleFilterChange ──

  describe("handleFilterChange", () => {
    it("sets a simple filter value", () => {
      getState().handleFilterChange({
        status: { included: ["Won"], excluded: [] },
      });
      expect(included(getFilters().status)).toEqual(["Won"]);
    });

    it("normalizes array-based legacy values to { included, excluded }", () => {
      getState().handleFilterChange({
        status: ["Won", "Lost"] as unknown,
      });
      expect(included(getFilters().status)).toEqual(["Won", "Lost"]);
      expect(excluded(getFilters().status)).toEqual([]);
    });

    it("normalizes null/undefined to empty filter", () => {
      getState().handleFilterChange({ status: null as unknown });
      expect(getFilters().status).toEqual({ included: [], excluded: [] });
    });

    it("ignores invalid input (non-object)", () => {
      const before = getFilters();
      getState().handleFilterChange(null as unknown as Record<string, unknown>);
      expect(getFilters()).toEqual(before);
    });

    it("preserves other filter keys when updating one", () => {
      getState().handleFilterChange({
        ...getFilters(),
        status: { included: ["Won"], excluded: [] },
      });
      getState().handleFilterChange({
        ...getFilters(),
        people: { included: ["Alice"], excluded: [] },
      });
      expect(included(getFilters().status)).toEqual(["Won"]);
      expect(included(getFilters().people)).toEqual(["Alice"]);
    });
  });

  // ── 3. handleToggleFilter ──

  describe("handleToggleFilter", () => {
    it("toggles a value from absent to included", () => {
      getState().handleToggleFilter("status", "Won");
      expect(included(getFilters().status)).toContain("Won");
    });

    it("toggles a value from included to excluded", () => {
      getState().handleToggleFilter("status", "Won");
      expect(included(getFilters().status)).toContain("Won");

      getState().handleToggleFilter("status", "Won");
      expect(included(getFilters().status)).not.toContain("Won");
      expect(excluded(getFilters().status)).toContain("Won");
    });

    it("toggles a value from excluded to absent", () => {
      getState().handleToggleFilter("status", "Won");
      getState().handleToggleFilter("status", "Won"); // now excluded
      getState().handleToggleFilter("status", "Won"); // now absent
      expect(included(getFilters().status)).not.toContain("Won");
      expect(excluded(getFilters().status)).not.toContain("Won");
    });

    it("does nothing for invalid filter type", () => {
      const before = getFilters();
      getState().handleToggleFilter("nonExistentType", "value");
      expect(getFilters()).toEqual(before);
    });

    it("does nothing for empty type", () => {
      const before = getFilters();
      getState().handleToggleFilter("", "value");
      expect(getFilters()).toEqual(before);
    });
  });

  // ── 4. handleClearAllFilters ──

  describe("handleClearAllFilters", () => {
    it("resets all filters to initial state", () => {
      // Set some filters
      getState().handleFilterChange({
        ...getFilters(),
        status: { included: ["Won"], excluded: ["Lost"] },
        people: { included: ["Alice", "Bob"], excluded: [] },
        macroGrades: { included: ["M+"], excluded: [] },
      });

      getState().handleClearAllFilters();
      expect(getFilters()).toEqual(initializeFilters());
    });

    it("is idempotent on already-clear state", () => {
      getState().handleClearAllFilters();
      expect(getFilters()).toEqual(initializeFilters());
    });
  });

  // ── 5. handleClearFilterType ──

  describe("handleClearFilterType", () => {
    it("clears only the specified filter type", () => {
      getState().handleFilterChange({
        ...getFilters(),
        status: { included: ["Won"], excluded: [] },
        people: { included: ["Alice"], excluded: [] },
      });

      getState().handleClearFilterType("status");
      expect(included(getFilters().status)).toEqual([]);
      expect(included(getFilters().people)).toEqual(["Alice"]);
    });

    it("does nothing for invalid filter type", () => {
      getState().handleFilterChange({
        ...getFilters(),
        status: { included: ["Won"], excluded: [] },
      });
      getState().handleClearFilterType("nonExistent");
      expect(included(getFilters().status)).toEqual(["Won"]);
    });

    it("does nothing for empty type", () => {
      getState().handleFilterChange({
        ...getFilters(),
        status: { included: ["Won"], excluded: [] },
      });
      getState().handleClearFilterType("");
      expect(included(getFilters().status)).toEqual(["Won"]);
    });
  });

  // ── 6. Bidirectional sync: Service Lines <-> Offerings ──

  describe("bidirectional sync — Service Lines <-> Offerings", () => {
    it("adding a service line auto-adds its offerings", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["Technology"], excluded: [] },
        },
        {},
        SERVICE_TO_OFFERING
      );
      const offerings = included(getFilters().serviceOfferings);
      expect(offerings).toContain("Technology::Cloud");
      expect(offerings).toContain("Technology::Data");
      expect(offerings).toContain("Technology::AI");
    });

    it("adding multiple service lines auto-adds all their offerings", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["Technology", "Analytics"], excluded: [] },
        },
        {},
        SERVICE_TO_OFFERING
      );
      const offerings = included(getFilters().serviceOfferings);
      expect(offerings).toContain("Technology::Cloud");
      expect(offerings).toContain("Analytics::BI");
      expect(offerings).toContain("Analytics::DataScience");
    });

    it("removing a service line removes its offerings", () => {
      // First add two lines
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["Technology", "Consulting"], excluded: [] },
        },
        {},
        SERVICE_TO_OFFERING
      );

      // Then remove Technology
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["Consulting"], excluded: [] },
        },
        {},
        SERVICE_TO_OFFERING
      );

      const offerings = included(getFilters().serviceOfferings);
      expect(offerings).not.toContain("Technology::Cloud");
      expect(offerings).not.toContain("Technology::Data");
      expect(offerings).not.toContain("Technology::AI");
      // Consulting offerings should remain
      expect(offerings).toContain("Consulting::Strategy");
      expect(offerings).toContain("Consulting::Operations");
    });

    it("adding an offering auto-adds its parent service line", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceOfferings: { included: ["Technology::Cloud"], excluded: [] },
        },
        {},
        SERVICE_TO_OFFERING
      );
      const lines = included(getFilters().serviceLine1);
      expect(lines).toContain("Technology");
    });

    it("removing the last offering of a line removes the line", () => {
      // Add a line (auto-adds offerings)
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["Analytics"], excluded: [] },
        },
        {},
        SERVICE_TO_OFFERING
      );
      expect(included(getFilters().serviceOfferings)).toContain("Analytics::BI");
      expect(included(getFilters().serviceOfferings)).toContain("Analytics::DataScience");

      // Remove both offerings manually
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceOfferings: {
            included: included(getFilters().serviceOfferings).filter((o) => !o.startsWith("Analytics::")),
            excluded: [],
          },
        },
        {},
        SERVICE_TO_OFFERING
      );

      expect(included(getFilters().serviceLine1)).not.toContain("Analytics");
    });

    it("removing one offering keeps the line if other offerings remain", () => {
      // Add Technology (3 offerings)
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["Technology"], excluded: [] },
        },
        {},
        SERVICE_TO_OFFERING
      );

      // Remove only Cloud
      const currentOfferings = included(getFilters().serviceOfferings);
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceOfferings: {
            included: currentOfferings.filter((o) => o !== "Technology::Cloud"),
            excluded: [],
          },
        },
        {},
        SERVICE_TO_OFFERING
      );

      expect(included(getFilters().serviceLine1)).toContain("Technology");
      expect(included(getFilters().serviceOfferings)).not.toContain("Technology::Cloud");
      expect(included(getFilters().serviceOfferings)).toContain("Technology::Data");
    });

    it("does not remove shared offerings when removing one of two service lines", () => {
      // Create a map where two lines share an offering
      const sharedMap: Record<string, string[]> = {
        LineA: ["LineA::Shared", "LineA::Unique"],
        LineB: ["LineB::Only", "LineA::Shared"], // LineA::Shared is in both
      };

      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["LineA", "LineB"], excluded: [] },
        },
        {},
        sharedMap
      );

      // Remove LineA
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["LineB"], excluded: [] },
        },
        {},
        sharedMap
      );

      const offerings = included(getFilters().serviceOfferings);
      // Shared offering should remain because LineB still references it
      expect(offerings).toContain("LineA::Shared");
      // LineA-only offering should be gone
      expect(offerings).not.toContain("LineA::Unique");
      // LineB offering should remain
      expect(offerings).toContain("LineB::Only");
    });
  });

  // ── 7. Bidirectional sync: Segment Codes <-> Sub-Segments ──

  describe("bidirectional sync — Segment Codes <-> Sub-Segments", () => {
    it("adding a segment code auto-adds its sub-segments", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["FS"], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT
      );
      const subs = included(getFilters().subSegments);
      expect(subs).toContain("FS-Banking");
      expect(subs).toContain("FS-Insurance");
      expect(subs).toContain("FS-AssetMgmt");
    });

    it("adding multiple segment codes adds all their sub-segments", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["FS", "PS"], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT
      );
      const subs = included(getFilters().subSegments);
      expect(subs).toContain("FS-Banking");
      expect(subs).toContain("PS-Telco");
      expect(subs).toContain("PS-Media");
    });

    it("removing a segment code removes its sub-segments", () => {
      // Add two codes
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["FS", "PS"], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT
      );

      // Remove FS
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["PS"], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT
      );

      const subs = included(getFilters().subSegments);
      expect(subs).not.toContain("FS-Banking");
      expect(subs).not.toContain("FS-Insurance");
      expect(subs).toContain("PS-Telco");
      expect(subs).toContain("PS-Media");
    });

    it("does not remove shared sub-segments when removing one of two codes", () => {
      const sharedMap: Record<string, string[]> = {
        A: ["Shared-Sub", "A-Only"],
        B: ["Shared-Sub", "B-Only"],
      };

      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["A", "B"], excluded: [] },
        },
        sharedMap
      );

      // Remove code A
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["B"], excluded: [] },
        },
        sharedMap
      );

      const subs = included(getFilters().subSegments);
      expect(subs).toContain("Shared-Sub");
      expect(subs).not.toContain("A-Only");
      expect(subs).toContain("B-Only");
    });

    it("removing the last sub-segment of a code removes the code", () => {
      // Add PS (has Telco, Media)
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["PS"], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT
      );

      // Remove both sub-segments
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegments: { included: [], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT
      );

      expect(included(getFilters().subSegmentCodes)).not.toContain("PS");
    });

    it("removing one sub-segment keeps the code if others remain", () => {
      // Add EN (has Oil, Gas, Renewables)
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["EN"], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT
      );

      // Remove only EN-Oil
      const currentSubs = included(getFilters().subSegments);
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegments: {
            included: currentSubs.filter((s) => s !== "EN-Oil"),
            excluded: [],
          },
        },
        SEGMENT_TO_SUB_SEGMENT
      );

      expect(included(getFilters().subSegmentCodes)).toContain("EN");
      expect(included(getFilters().subSegments)).not.toContain("EN-Oil");
      expect(included(getFilters().subSegments)).toContain("EN-Gas");
      expect(included(getFilters().subSegments)).toContain("EN-Renewables");
    });
  });

  // ── 8. Combined bidirectional sync (both maps at once) ──

  describe("combined bidirectional sync", () => {
    it("handles segment and service line changes simultaneously", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["FS"], excluded: [] },
          serviceLine1: { included: ["Technology"], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT,
        SERVICE_TO_OFFERING
      );

      expect(included(getFilters().subSegments)).toContain("FS-Banking");
      expect(included(getFilters().serviceOfferings)).toContain("Technology::Cloud");
    });
  });

  // ── 9. handleToggleFilter with bidirectional sync ──

  describe("handleToggleFilter with bidirectional sync", () => {
    it("toggling a service line triggers offering sync", () => {
      getState().handleToggleFilter("serviceLine1", "Technology", {}, SERVICE_TO_OFFERING);
      expect(included(getFilters().serviceLine1)).toContain("Technology");
      expect(included(getFilters().serviceOfferings)).toContain("Technology::Cloud");
    });

    it("toggling a segment code triggers sub-segment sync", () => {
      getState().handleToggleFilter("subSegmentCodes", "FS", SEGMENT_TO_SUB_SEGMENT, {});
      expect(included(getFilters().subSegmentCodes)).toContain("FS");
      expect(included(getFilters().subSegments)).toContain("FS-Banking");
    });
  });

  // ── 10. handleAccountChange ──

  describe("handleAccountChange", () => {
    it("sets accounts from new value", () => {
      getState().handleAccountChange(null, ["Acme Corp", "Globex"]);
      expect(included(getFilters().accounts)).toEqual(["Acme Corp", "Globex"]);
    });

    it("clears accounts when newValue is null", () => {
      getState().handleAccountChange(null, ["Acme Corp"]);
      getState().handleAccountChange(null, null);
      expect(included(getFilters().accounts)).toEqual([]);
    });

    it("clears accounts when newValue is empty array", () => {
      getState().handleAccountChange(null, ["Acme Corp"]);
      getState().handleAccountChange(null, []);
      expect(included(getFilters().accounts)).toEqual([]);
    });
  });

  // ── 11. setFilters ──

  describe("setFilters", () => {
    it("sets filters directly with an object", () => {
      const custom = initializeFilters();
      custom.status = { included: ["Won"], excluded: [] };
      getState().setFilters(custom);
      expect(included(getFilters().status)).toEqual(["Won"]);
    });

    it("sets filters with an updater function", () => {
      getState().setFilters((prev) => ({
        ...prev,
        people: { included: ["Alice"], excluded: ["Bob"] },
      }));
      expect(included(getFilters().people)).toEqual(["Alice"]);
      expect(excluded(getFilters().people)).toEqual(["Bob"]);
    });
  });

  // ── 12. setSegmentModes / setServiceLineModes ──

  describe("mode setters", () => {
    it("setSegmentModes with value", () => {
      const modes = new Map<string, "team" | "both">([["FS", "team"]]);
      getState().setSegmentModes(modes);
      expect(getState().segmentModes.get("FS")).toBe("team");
    });

    it("setSegmentModes with updater", () => {
      getState().setSegmentModes(new Map([["FS", "team"]]));
      getState().setSegmentModes((prev) => {
        const next = new Map(prev);
        next.set("PS", "both");
        return next;
      });
      expect(getState().segmentModes.get("FS")).toBe("team");
      expect(getState().segmentModes.get("PS")).toBe("both");
    });

    it("setServiceLineModes with value", () => {
      const modes = new Map<string, "team" | "both">([["Consulting", "both"]]);
      getState().setServiceLineModes(modes);
      expect(getState().serviceLineModes.get("Consulting")).toBe("both");
    });

    it("setServiceLineModes with updater", () => {
      getState().setServiceLineModes(new Map([["Consulting", "both"]]));
      getState().setServiceLineModes((prev) => {
        const next = new Map(prev);
        next.set("Technology", "team");
        return next;
      });
      expect(getState().serviceLineModes.get("Consulting")).toBe("both");
      expect(getState().serviceLineModes.get("Technology")).toBe("team");
    });
  });

  // ── 13. Derived selectors ──

  describe("derived selectors", () => {
    // Note: Derived selectors that use React hooks (useFilterStore, useCrmStore)
    // cannot be called outside a React component. We test the underlying logic
    // directly by simulating what the selectors compute.

    describe("useActiveFilterCount logic", () => {
      it("returns 0 for initial state", () => {
        const filters = getFilters();
        const count = Object.values(filters).reduce((acc: number, fv) => {
          return acc + fv.included.length + fv.excluded.length;
        }, 0);
        expect(count).toBe(0);
      });

      it("counts included and excluded values across all types", () => {
        getState().handleFilterChange({
          ...getFilters(),
          status: { included: ["Won", "Lost"], excluded: ["Cancelled"] },
          people: { included: ["Alice"], excluded: [] },
        });

        const filters = getFilters();
        const count = Object.values(filters).reduce((acc: number, fv) => {
          return acc + fv.included.length + fv.excluded.length;
        }, 0);
        expect(count).toBe(4); // 2 included + 1 excluded + 1 included
      });
    });

    describe("useFilteredSubSegments logic", () => {
      it("returns empty array when no segment codes selected", () => {
        const codes = getFilters().subSegmentCodes.included;
        const result: string[] = [];
        codes.forEach((code) => {
          if (SEGMENT_TO_SUB_SEGMENT[code]) result.push(...SEGMENT_TO_SUB_SEGMENT[code]);
        });
        expect(result).toEqual([]);
      });

      it("returns sub-segments for selected codes", () => {
        getState().handleFilterChange(
          {
            ...getFilters(),
            subSegmentCodes: { included: ["FS", "PS"], excluded: [] },
          },
          SEGMENT_TO_SUB_SEGMENT
        );

        const codes = getFilters().subSegmentCodes.included;
        const result: string[] = [];
        codes.forEach((code) => {
          if (SEGMENT_TO_SUB_SEGMENT[code]) result.push(...SEGMENT_TO_SUB_SEGMENT[code]);
        });
        const unique = [...new Set(result)];
        expect(unique).toContain("FS-Banking");
        expect(unique).toContain("PS-Telco");
      });

      it("deduplicates shared sub-segments", () => {
        const sharedMap: Record<string, string[]> = {
          A: ["Shared", "A-Only"],
          B: ["Shared", "B-Only"],
        };

        useFilterStore.setState({
          filters: {
            ...initializeFilters(),
            subSegmentCodes: { included: ["A", "B"], excluded: [] },
          },
        });

        const codes = getFilters().subSegmentCodes.included;
        const result: string[] = [];
        codes.forEach((code) => {
          if (sharedMap[code]) result.push(...sharedMap[code]);
        });
        const unique = [...new Set(result)];
        expect(unique).toEqual(["Shared", "A-Only", "B-Only"]);
      });
    });

    describe("useFilteredServiceOfferings logic", () => {
      it("returns empty array when no service lines selected", () => {
        const lines = getFilters().serviceLine1.included;
        expect(lines).toHaveLength(0);
        const result: string[] = [];
        lines.forEach((line) => {
          if (SERVICE_TO_OFFERING[line]) result.push(...SERVICE_TO_OFFERING[line]);
        });
        expect(result).toEqual([]);
      });

      it("returns offerings for selected service lines", () => {
        getState().handleFilterChange(
          {
            ...getFilters(),
            serviceLine1: { included: ["Consulting"], excluded: [] },
          },
          {},
          SERVICE_TO_OFFERING
        );

        const lines = getFilters().serviceLine1.included;
        const result: string[] = [];
        lines.forEach((line) => {
          if (SERVICE_TO_OFFERING[line]) result.push(...SERVICE_TO_OFFERING[line]);
        });
        const unique = [...new Set(result)];
        expect(unique).toContain("Consulting::Strategy");
        expect(unique).toContain("Consulting::Operations");
        expect(unique).not.toContain("Technology::Cloud");
      });
    });
  });

  // ── 14. Edge cases ──

  describe("edge cases", () => {
    it("handles empty maps gracefully", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["Unknown"], excluded: [] },
        },
        {},
        {}
      );
      // Should not crash; unknown line just stays as-is
      expect(included(getFilters().serviceLine1)).toContain("Unknown");
    });

    it("handles segment code not present in map", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          subSegmentCodes: { included: ["UNKNOWN"], excluded: [] },
        },
        SEGMENT_TO_SUB_SEGMENT
      );
      expect(included(getFilters().subSegmentCodes)).toContain("UNKNOWN");
      // No sub-segments added since UNKNOWN is not in the map
      expect(included(getFilters().subSegments)).toEqual([]);
    });

    it("preserves excluded arrays through bidirectional sync", () => {
      getState().handleFilterChange(
        {
          ...getFilters(),
          serviceLine1: { included: ["Technology"], excluded: ["Consulting"] },
        },
        {},
        SERVICE_TO_OFFERING
      );
      expect(excluded(getFilters().serviceLine1)).toContain("Consulting");
      expect(included(getFilters().serviceLine1)).toContain("Technology");
    });

    it("rapid sequential updates produce consistent state", () => {
      getState().handleFilterChange(
        { ...getFilters(), serviceLine1: { included: ["Technology"], excluded: [] } },
        {},
        SERVICE_TO_OFFERING
      );
      getState().handleFilterChange(
        { ...getFilters(), serviceLine1: { included: ["Technology", "Analytics"], excluded: [] } },
        {},
        SERVICE_TO_OFFERING
      );
      getState().handleFilterChange(
        { ...getFilters(), serviceLine1: { included: ["Analytics"], excluded: [] } },
        {},
        SERVICE_TO_OFFERING
      );

      const lines = included(getFilters().serviceLine1);
      const offerings = included(getFilters().serviceOfferings);

      expect(lines).toEqual(["Analytics"]);
      expect(offerings).toContain("Analytics::BI");
      expect(offerings).toContain("Analytics::DataScience");
      expect(offerings).not.toContain("Technology::Cloud");
    });
  });
});
