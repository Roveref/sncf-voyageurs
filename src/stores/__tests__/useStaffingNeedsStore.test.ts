import { describe, it, expect, beforeEach } from "vitest";
import { useStaffingNeedsStore } from "../useStaffingNeedsStore";

describe("useStaffingNeedsStore", () => {
  beforeEach(() => {
    useStaffingNeedsStore.getState().setSkillsCatalog([]);
  });

  describe("skillsCatalog", () => {
    it("sets and reads skills catalog", () => {
      const skills = [
        { name: "SAP", category: "Technology", usageCount: 15 },
        { name: "Python", category: "Technology", usageCount: 8 },
      ];
      useStaffingNeedsStore.getState().setSkillsCatalog(skills);
      expect(useStaffingNeedsStore.getState().skillsCatalog).toHaveLength(2);
      expect(useStaffingNeedsStore.getState().skillsCatalog[0].name).toBe("SAP");
    });
  });
});
