import { describe, it, expect } from "vitest";
import { getStatusMap, getAllStatuses, COLORS, STATUS_CATEGORIES, SIZE_RANGES } from "./constants";

describe("getStatusMap", () => {
  it("returns entries for pipeline status numbers", () => {
    const map = getStatusMap();
    expect(map[1]).toBeDefined();
    expect(map[4]).toBeDefined();
    expect(map[6]).toBeDefined();
    expect(map[11]).toBeDefined();
  });

  it("returns values with number prefix format", () => {
    const map = getStatusMap();
    for (const [num, label] of Object.entries(map)) {
      expect(label).toMatch(new RegExp(`^${num} - .+`));
    }
  });

  it("contains recognizable status text in each entry", () => {
    const map = getStatusMap();
    expect(map[1]).toContain("Lead Identified");
    expect(map[4]).toContain("Go Approved");
    expect(map[6]).toContain("Proposal Submitted");
    expect(map[11]).toContain("Client Tells Us We Have Won");
  });
});

describe("getAllStatuses", () => {
  it("returns an array of StatusOption objects", () => {
    const statuses = getAllStatuses();
    expect(Array.isArray(statuses)).toBe(true);
    expect(statuses.length).toBeGreaterThan(0);
  });

  it("each entry has status and statusNumber fields", () => {
    const statuses = getAllStatuses();
    for (const s of statuses) {
      expect(s).toHaveProperty("status");
      expect(s).toHaveProperty("statusNumber");
      expect(typeof s.status).toBe("string");
      expect(typeof s.statusNumber).toBe("number");
    }
  });

  it("statusNumber values match the pipeline status numbers", () => {
    const statuses = getAllStatuses();
    const numbers = statuses.map((s) => s.statusNumber);
    expect(numbers).toContain(1);
    expect(numbers).toContain(4);
    expect(numbers).toContain(6);
    expect(numbers).toContain(11);
  });

  it("status strings follow the 'N - Label' format", () => {
    const statuses = getAllStatuses();
    for (const s of statuses) {
      expect(s.status).toMatch(new RegExp(`^${s.statusNumber} - .+`));
    }
  });
});

describe("COLORS", () => {
  it("is a non-empty array", () => {
    expect(COLORS.length).toBeGreaterThan(0);
  });

  it("contains valid hex color strings", () => {
    for (const color of COLORS) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("starts with BearingPoint red", () => {
    expect(COLORS[0]).toBe("#FF3D47");
  });
});

describe("STATUS_CATEGORIES", () => {
  it("has early, mid, and late arrays", () => {
    expect(Array.isArray(STATUS_CATEGORIES.early)).toBe(true);
    expect(Array.isArray(STATUS_CATEGORIES.mid)).toBe(true);
    expect(Array.isArray(STATUS_CATEGORIES.late)).toBe(true);
  });

  it("early statuses contain low numbers", () => {
    for (const num of STATUS_CATEGORIES.early) {
      expect(num).toBeLessThanOrEqual(4);
    }
  });

  it("mid statuses contain status 6", () => {
    expect(STATUS_CATEGORIES.mid).toContain(6);
  });

  it("late statuses contain high numbers", () => {
    for (const num of STATUS_CATEGORIES.late) {
      expect(num).toBeGreaterThanOrEqual(11);
    }
  });

  it("no overlap between categories", () => {
    const all = [...STATUS_CATEGORIES.early, ...STATUS_CATEGORIES.mid, ...STATUS_CATEGORIES.late];
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });
});

describe("SIZE_RANGES", () => {
  it("has small, medium, and large ranges", () => {
    expect(SIZE_RANGES.small).toBeDefined();
    expect(SIZE_RANGES.medium).toBeDefined();
    expect(SIZE_RANGES.large).toBeDefined();
  });

  it("ranges are contiguous (small max = medium min, medium max = large min)", () => {
    expect(SIZE_RANGES.small.max).toBe(SIZE_RANGES.medium.min);
    expect(SIZE_RANGES.medium.max).toBe(SIZE_RANGES.large.min);
  });

  it("small starts at 0 and large ends at Infinity", () => {
    expect(SIZE_RANGES.small.min).toBe(0);
    expect(SIZE_RANGES.large.max).toBe(Infinity);
  });

  it("each range has a non-empty name", () => {
    for (const range of Object.values(SIZE_RANGES)) {
      expect(range.name.length).toBeGreaterThan(0);
    }
  });
});
