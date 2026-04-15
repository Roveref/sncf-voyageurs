import { describe, it, expect, beforeEach } from "vitest";
import { useUserDataStore } from "../useUserDataStore";
import type { ManualOpportunity, ManualAccount } from "../useUserDataStore";

describe("useUserDataStore", () => {
  beforeEach(() => {
    useUserDataStore.setState({
      statusOverrides: {},
      manualOpportunities: [],
      manualAccounts: [],
      opportunityActions: {},
      staffingNeeds: {},
    });
  });

  // ── Status overrides ──

  describe("setStatusOverride", () => {
    it("creates an override", () => {
      useUserDataStore.getState().setStatusOverride("opp1", 1, 4, "Upgraded");
      const overrides = useUserDataStore.getState().statusOverrides;
      expect(overrides["opp1"]).toBeDefined();
      expect(overrides["opp1"].originalStatus).toBe(1);
      expect(overrides["opp1"].newStatus).toBe(4);
      expect(overrides["opp1"].comment).toBe("Upgraded");
    });

    it("reverts when newStatus equals originalStatus", () => {
      useUserDataStore.getState().setStatusOverride("opp1", 1, 4);
      useUserDataStore.getState().setStatusOverride("opp1", 1, 1);
      const overrides = useUserDataStore.getState().statusOverrides;
      expect(overrides["opp1"]).toBeUndefined();
    });

    it("adds bookingDate for status 14 (Booked)", () => {
      useUserDataStore.getState().setStatusOverride("opp1", 1, 14, "", "2025-06-15");
      const override = useUserDataStore.getState().statusOverrides["opp1"];
      expect(override.bookingDate).toBe("2025-06-15");
    });

    it("adds bookingDate for status 15 (Lost)", () => {
      useUserDataStore.getState().setStatusOverride("opp1", 1, 15);
      const override = useUserDataStore.getState().statusOverrides["opp1"];
      expect(override.bookingDate).toBeDefined();
    });
  });

  describe("removeStatusOverride", () => {
    it("deletes the override entry entirely", () => {
      useUserDataStore.getState().setStatusOverride("opp1", 1, 4);
      useUserDataStore.getState().removeStatusOverride("opp1");
      const overrides = useUserDataStore.getState().statusOverrides;
      expect(overrides["opp1"]).toBeUndefined();
    });
  });

  describe("mergeExcelOverrides", () => {
    it("merges new overrides without replacing existing", () => {
      useUserDataStore.getState().setStatusOverride("opp1", 1, 4);
      useUserDataStore.getState().mergeExcelOverrides({
        opp1: { originalStatus: 1, newStatus: 6, comment: "From Excel", modifiedAt: "" },
        opp2: { originalStatus: 4, newStatus: 11, comment: "New", modifiedAt: "" },
      });
      const overrides = useUserDataStore.getState().statusOverrides;
      // opp1 unchanged (existing takes precedence)
      expect(overrides["opp1"].newStatus).toBe(4);
      // opp2 added
      expect(overrides["opp2"].newStatus).toBe(11);
    });
  });

  // ── Manual opportunities ──

  describe("addManualOpportunity", () => {
    it("adds a new opportunity", () => {
      const opp: ManualOpportunity = {
        opportunityId: "M-001",
        opportunity: "Test Opp",
        account: "Test Account",
        status: 1,
        isManual: true,
      };
      useUserDataStore.getState().addManualOpportunity(opp);
      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(1);
    });

    it("prevents duplicate IDs", () => {
      const opp: ManualOpportunity = {
        opportunityId: "M-001",
        opportunity: "Test",
        account: "Acc",
        status: 1,
      };
      useUserDataStore.getState().addManualOpportunity(opp);
      useUserDataStore.getState().addManualOpportunity(opp);
      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(1);
    });
  });

  describe("deleteManualOpportunity (cascade)", () => {
    it("deletes opportunity and cascades to actions/needs", () => {
      const opp: ManualOpportunity = {
        opportunityId: "M-001",
        opportunity: "Test",
        account: "Acc",
        status: 1,
      };
      useUserDataStore.getState().addManualOpportunity(opp);
      useUserDataStore
        .getState()
        .setOpportunityActions("M-001", [
          { id: "a1", description: "Action", owner: "User", dueDate: "2025-01-01", priority: "high", status: "open" },
        ]);
      useUserDataStore
        .getState()
        .setStaffingNeeds("M-001", [
          { id: "n1", grade: "Manager", startDate: "2025-01-01", endDate: "2025-06-01", fte: 1 } as any,
        ]);

      useUserDataStore.getState().deleteManualOpportunity("M-001");

      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(0);
      expect(useUserDataStore.getState().opportunityActions["M-001"]).toBeUndefined();
      expect(useUserDataStore.getState().staffingNeeds["M-001"]).toBeUndefined();
    });
  });

  // ── Manual accounts ──

  describe("deleteManualAccount (cascade)", () => {
    it("deletes account and cascades to its opportunities and their data", () => {
      useUserDataStore.getState().addManualAccount({ account: "CascadeAccount" });
      const opp: ManualOpportunity = {
        opportunityId: "M-002",
        opportunity: "Opp For Cascade",
        account: "CascadeAccount",
        status: 1,
      };
      useUserDataStore.getState().addManualOpportunity(opp);
      useUserDataStore
        .getState()
        .setOpportunityActions("M-002", [
          { id: "a2", description: "Action2", owner: "User", dueDate: "2025-01-01", priority: "low", status: "open" },
        ]);

      useUserDataStore.getState().deleteManualAccount("CascadeAccount");

      expect(useUserDataStore.getState().manualAccounts).toHaveLength(0);
      expect(useUserDataStore.getState().manualOpportunities).toHaveLength(0);
      expect(useUserDataStore.getState().opportunityActions["M-002"]).toBeUndefined();
    });
  });

  // ── Opportunity data ──

  describe("setOpportunityActions", () => {
    it("sets actions for an opportunity", () => {
      useUserDataStore.getState().setOpportunityActions("opp1", [
        {
          id: "a1",
          description: "Do something",
          owner: "Me",
          dueDate: "2025-01-01",
          priority: "high",
          status: "open",
        },
      ]);
      expect(useUserDataStore.getState().opportunityActions["opp1"]).toHaveLength(1);
    });

    it("removes entry when setting empty array", () => {
      useUserDataStore
        .getState()
        .setOpportunityActions("opp1", [
          { id: "a1", description: "Do", owner: "Me", dueDate: "2025-01-01", priority: "low", status: "open" },
        ]);
      useUserDataStore.getState().setOpportunityActions("opp1", []);
      expect(useUserDataStore.getState().opportunityActions["opp1"]).toBeUndefined();
    });
  });

  describe("deleteOpportunityData", () => {
    it("removes all actions and needs for an opportunity", () => {
      useUserDataStore
        .getState()
        .setOpportunityActions("opp1", [
          { id: "a1", description: "A", owner: "X", dueDate: "", priority: "low", status: "open" },
        ]);
      useUserDataStore.getState().deleteOpportunityData("opp1");
      expect(useUserDataStore.getState().opportunityActions["opp1"]).toBeUndefined();
    });
  });
});
