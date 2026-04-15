/**
 * Data route tests: input validation, CRUD operations, edge cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock database
const mockGet = vi.fn((_args: unknown[]) => null as unknown);
const mockAll = vi.fn((_args: unknown[]) => [] as unknown[]);
const mockRun = vi.fn((_args: unknown[]) => ({ changes: 1 }));

vi.mock("../db/database.js", () => ({
  default: {
    prepare: () => ({
      get: (...args: unknown[]) => mockGet(args),
      all: (...args: unknown[]) => {
        try {
          return mockAll(args);
        } catch {
          return [];
        }
      },
      run: (...args: unknown[]) => mockRun(args),
    }),
    transaction: (fn: Function) => fn,
  },
  isDemoMode: () => false,
}));

const { default: dataRouter } = await import("../routes/data.js");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/data", dataRouter);
  // Error handler for debugging
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

describe("GET /api/data/employees", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([]);
  });

  it("returns employees list", async () => {
    mockAll.mockReturnValue([{ empId: "E1", name: "Alice" }]);
    const res = await request(app).get("/api/data/employees");
    expect(res.status).toBe(200);
    expect(res.body.employees).toHaveLength(1);
  });

  it("rejects negative offset via zod validation", async () => {
    const res = await request(app).get("/api/data/employees?offset=-1");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("rejects limit over 1000", async () => {
    const res = await request(app).get("/api/data/employees?limit=5000");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("accepts valid pagination params", async () => {
    mockAll.mockReturnValue([]);
    const res = await request(app).get("/api/data/employees?limit=50&offset=10");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/data/employees/:empId", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when employee not found", async () => {
    mockGet.mockReturnValue(null);
    const res = await request(app).get("/api/data/employees/UNKNOWN");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Employee not found.");
  });

  it("returns employee with assignments and skills", async () => {
    mockGet.mockReturnValue({ empId: "E1", name: "Alice", grade: "Consultant" });
    mockAll.mockReturnValue([]);
    const res = await request(app).get("/api/data/employees/E1");
    expect(res.status).toBe(200);
    expect(res.body.employee.empId).toBe("E1");
  });
});

describe("POST /api/data/opportunities", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id is missing", async () => {
    const res = await request(app).post("/api/data/opportunities").send({ name: "Test" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app).post("/api/data/opportunities").send({ id: "OPP-1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 when winPct > 100", async () => {
    const res = await request(app).post("/api/data/opportunities").send({ id: "OPP-1", name: "Test", winPct: 150 });
    expect(res.status).toBe(400);
  });

  it("creates opportunity with valid data", async () => {
    const res = await request(app).post("/api/data/opportunities").send({ id: "OPP-1", name: "Test Opportunity" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("creates opportunity with all optional fields", async () => {
    const res = await request(app).post("/api/data/opportunities").send({
      id: "OPP-2",
      name: "Full Opportunity",
      account: "Acme Corp",
      status: 6,
      grossRevenue: 100000,
      netRevenue: 80000,
      winPct: 75,
      segment: "FIN",
      manager: "John",
      partner: "Jane",
    });
    expect(res.status).toBe(201);
  });
});

describe("PUT /api/data/opportunities/:id", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when opportunity not found", async () => {
    mockRun.mockReturnValue({ changes: 0 });
    const res = await request(app).put("/api/data/opportunities/UNKNOWN").send({ name: "Updated" });
    expect(res.status).toBe(404);
  });

  it("updates opportunity successfully", async () => {
    mockRun.mockReturnValueOnce({ changes: 1 }); // user_opportunities update
    const res = await request(app).put("/api/data/opportunities/OPP-1").send({ name: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("GET /api/data/opportunities", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([]);
  });

  it("returns opportunities list", async () => {
    mockAll.mockReturnValue([{ id: "OPP-1", name: "Test" }]);
    const res = await request(app).get("/api/data/opportunities");
    expect(res.status).toBe(200);
    expect(res.body.opportunities).toHaveLength(1);
  });

  it("rejects negative offset", async () => {
    const res = await request(app).get("/api/data/opportunities?offset=-5");
    expect(res.status).toBe(400);
  });
});
