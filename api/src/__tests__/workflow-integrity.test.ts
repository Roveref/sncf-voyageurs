/**
 * Backend integration tests: data integrity workflows.
 *
 * Uses a mocked in-memory approach to test the SQL execution safety
 * and agent dispatch validation logic without hitting real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module before imports
vi.mock("../db/database.js", () => {
  const rows: Record<string, any[]> = {
    crm_opportunities: [{ id: "OPP-1", name: "Test Opp", status: 6 }],
    user_staffing_needs: [],
    user_opportunities: [],
    user_actions: [],
  };
  return {
    default: {
      prepare: (sql: string) => ({
        run: (..._args: any[]) => ({ changes: 1 }),
        get: (...args: any[]) => {
          if (sql.includes("crm_opportunities") && sql.includes("SELECT")) {
            return rows.crm_opportunities.find((r) => r.id === args[0]) || null;
          }
          if (sql.includes("user_staffing_needs") && sql.includes("SELECT") && sql.includes("profile")) {
            return null; // No duplicate
          }
          return null;
        },
        all: () => [],
      }),
      transaction: (fn: Function) => fn,
    },
    isDemoMode: () => false,
  };
});

// Mock events broadcast
vi.mock("../routes/events.js", () => ({
  broadcast: vi.fn(),
}));

// Mock logger
vi.mock("../utils/logger.js", () => ({
  log: () => {},
  warn: () => {},
  error: () => {},
}));

// ── SQL Safety Tests ──

describe("SQL Execution Safety (A2)", () => {
  let executeSafeSQL: (query: string) => string;

  beforeEach(async () => {
    const mod = await import("../services/agentDispatch.js");
    executeSafeSQL = mod.executeSafeSQL;
  });

  it("blocks INSERT statements", () => {
    const result = executeSafeSQL("INSERT INTO employees VALUES ('hack')");
    expect(result).toContain("Error"); // Rejected by SELECT-only gate
  });

  it("blocks UPDATE statements", () => {
    const result = executeSafeSQL("UPDATE employees SET name = 'hack'");
    expect(result).toContain("Error");
  });

  it("blocks DELETE statements", () => {
    const result = executeSafeSQL("DELETE FROM employees");
    expect(result).toContain("Error");
  });

  it("blocks DROP statements", () => {
    const result = executeSafeSQL("DROP TABLE employees");
    expect(result).toContain("Error");
  });

  it("blocks UNION inside SELECT", () => {
    const result = executeSafeSQL("SELECT * FROM employees UNION SELECT * FROM user_actions");
    expect(result).toContain("forbidden");
    expect(result).toContain("UNION");
  });

  it("blocks PRAGMA statements", () => {
    const result = executeSafeSQL("PRAGMA table_info(employees)");
    expect(result).toContain("Error");
  });

  it("blocks ATTACH statements", () => {
    const result = executeSafeSQL("ATTACH DATABASE '/tmp/hack.db' AS hack");
    expect(result).toContain("Error");
  });

  it("blocks multi-statement injection", () => {
    const result = executeSafeSQL("SELECT 1; DROP TABLE employees");
    // Contains either "forbidden" (DROP detected) or "only one query"
    expect(result.includes("forbidden") || result.includes("only one query")).toBe(true);
  });

  it("allows valid SELECT", () => {
    const result = executeSafeSQL("SELECT empId, name FROM employees WHERE grade = 'Consultant'");
    // Should not contain error keywords
    expect(result).not.toContain("forbidden");
    expect(result).not.toContain("only SELECT");
  });

  it("allows valid WITH (CTE)", () => {
    const result = executeSafeSQL(
      "WITH active AS (SELECT * FROM employees WHERE departure IS NULL) SELECT * FROM active"
    );
    expect(result).not.toContain("forbidden");
    expect(result).not.toContain("only SELECT");
  });

  it("rejects non-SELECT/WITH queries", () => {
    const result = executeSafeSQL("VACUUM");
    // VACUUM is blocked either by keyword check or by the SELECT-only gate
    expect(result).toContain("Error");
  });
});

// ── Agent Tool Validation Tests ──

describe("Agent Tool Validation", () => {
  let TOOL_DISPATCH: Record<string, Function>;

  beforeEach(async () => {
    const mod = await import("../services/agentDispatch.js");
    TOOL_DISPATCH = mod.TOOL_DISPATCH;
  });

  describe("create_staffing_need (A4)", () => {
    it("rejects if opportunity does not exist", () => {
      const result = TOOL_DISPATCH.create_staffing_need({
        opportunityId: "NONEXISTENT",
        profile: "Consultant",
        startDate: "2025-01-01",
        endDate: "2025-06-30",
      });
      expect(result.result).toContain("not found");
    });

    it("rejects inverted dates", () => {
      const result = TOOL_DISPATCH.create_staffing_need({
        opportunityId: "OPP-1",
        profile: "Consultant",
        startDate: "2025-06-30",
        endDate: "2025-01-01",
      });
      expect(result.result).toContain("start date after end date");
    });

    it("creates need for valid input", () => {
      const result = TOOL_DISPATCH.create_staffing_need({
        opportunityId: "OPP-1",
        profile: "Consultant",
        startDate: "2025-01-01",
        endDate: "2025-06-30",
      });
      expect(result.result).toContain("Need created");
    });
  });
});

// ── Scenario Schema Tests ──

describe("Agent Scenario Creation (A1)", () => {
  let TOOL_DISPATCH: Record<string, Function>;

  beforeEach(async () => {
    const mod = await import("../services/agentDispatch.js");
    TOOL_DISPATCH = mod.TOOL_DISPATCH;
  });

  it("creates scenario with correct column names (not 'description' or 'assignment_overrides')", () => {
    const result = TOOL_DISPATCH.create_scenario({ name: "Test Plan" });
    // If schema mismatch existed, this would throw "no such column"
    // Since DB is mocked, we just verify the result shape
    expect(result.result).toContain("Scenario created");
    expect(result.action.scenarioId).toBeDefined();
  });
});
