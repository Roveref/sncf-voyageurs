import { describe, it, expect } from "vitest";
import { safeJsonParse } from "../safeJson";

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("parses valid JSON array", () => {
    expect(safeJsonParse("[1,2,3]", [])).toEqual([1, 2, 3]);
  });

  it("returns fallback on invalid JSON", () => {
    expect(safeJsonParse("not json", {})).toEqual({});
  });

  it("returns fallback on empty string", () => {
    expect(safeJsonParse("", null)).toBeNull();
  });

  it("returns fallback on truncated JSON", () => {
    expect(safeJsonParse('{"a":', [])).toEqual([]);
  });

  it("preserves type of fallback", () => {
    const result = safeJsonParse<number[]>("invalid", [1, 2]);
    expect(result).toEqual([1, 2]);
  });
});
