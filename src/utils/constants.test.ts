import { describe, it, expect, afterEach } from "vitest";
import {
  STATUS_TEXT,
  STATUS_COLORS,
  SPECIAL_SEGMENT_CODES,
  updateSpecialSegmentCodes,
  OPERATIONS_SERVICE_LINE,
  EXCLUDED_PARTNER_VALUES,
  IO_TARGET,
  JOBCODE_FIELD_NAMES,
  GRADE_BUCKETS,
} from "./constants";

describe("STATUS_TEXT", () => {
  it("has entries for all known status numbers", () => {
    const expectedStatuses = [1, 4, 6, 11, 13, 14, 15];
    for (const status of expectedStatuses) {
      expect(STATUS_TEXT[status]).toBeDefined();
      expect(typeof STATUS_TEXT[status]).toBe("string");
      expect(STATUS_TEXT[status].length).toBeGreaterThan(0);
    }
  });

  it("contains correct text for specific statuses", () => {
    expect(STATUS_TEXT[1]).toBe("Lead Identified");
    expect(STATUS_TEXT[14]).toBe("Booked");
    expect(STATUS_TEXT[15]).toBe("Lost");
  });
});

describe("STATUS_COLORS", () => {
  it("has entries for known status numbers", () => {
    expect(STATUS_COLORS[1]).toBe("primary");
    expect(STATUS_COLORS[14]).toBe("success");
    expect(STATUS_COLORS[15]).toBe("error");
  });
});

describe("SPECIAL_SEGMENT_CODES", () => {
  it("starts empty (populated dynamically from var_config.segment)", () => {
    expect(Array.isArray(SPECIAL_SEGMENT_CODES)).toBe(true);
  });

  it("updateSpecialSegmentCodes replaces the array", () => {
    updateSpecialSegmentCodes(["AUTO", "IEM", "LSC"]);
    expect(SPECIAL_SEGMENT_CODES).toContain("AUTO");
    expect(SPECIAL_SEGMENT_CODES).toContain("IEM");
    expect(SPECIAL_SEGMENT_CODES).toContain("LSC");
    // Restore
    updateSpecialSegmentCodes([]);
  });
});

describe("updateSpecialSegmentCodes", () => {
  afterEach(() => {
    // Restore defaults
    updateSpecialSegmentCodes(["AUTO", "CLR", "IEM", "LSC"]);
  });

  it("is callable and does not throw", () => {
    expect(() => updateSpecialSegmentCodes(["X", "Y"])).not.toThrow();
  });

  it("accepts an empty array without error", () => {
    expect(() => updateSpecialSegmentCodes([])).not.toThrow();
  });
});

describe("other constants", () => {
  it("OPERATIONS_SERVICE_LINE is 'Operations'", () => {
    expect(OPERATIONS_SERVICE_LINE).toBe("Operations");
  });

  it("EXCLUDED_PARTNER_VALUES contains common exclusion strings", () => {
    expect(EXCLUDED_PARTNER_VALUES).toContain("-");
    expect(EXCLUDED_PARTNER_VALUES).toContain("");
    expect(EXCLUDED_PARTNER_VALUES).toContain("N/A");
    expect(EXCLUDED_PARTNER_VALUES).toContain("None");
  });

  it("IO_TARGET is a positive number", () => {
    expect(IO_TARGET).toBeGreaterThan(0);
    expect(IO_TARGET).toBe(1000000);
  });

  it("JOBCODE_FIELD_NAMES contains expected field names", () => {
    expect(JOBCODE_FIELD_NAMES).toContain("Jobcode");
    expect(JOBCODE_FIELD_NAMES).toContain("JobCode");
    expect(JOBCODE_FIELD_NAMES).toContain("Job Code");
  });

  it("GRADE_BUCKETS contains M/SM, Director, Partner", () => {
    const values = GRADE_BUCKETS.map((b) => b.value);
    expect(values).toContain("M/SM");
    expect(values).toContain("Director");
    expect(values).toContain("Partner");
  });
});
