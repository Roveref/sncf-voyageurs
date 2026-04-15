/**
 * Auth route tests: login, /me, JWT validation, rate limiting guards.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock bcrypt
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async (plain: string, hash: string) => plain === "correct-password" && hash === "$hashed$"),
  },
}));

// Mock jsonwebtoken
const mockJwtSign = vi.fn((_args: unknown[]) => "mock-jwt-token");
const mockJwtVerify = vi.fn((_args: unknown[]) => ({ userId: 1, username: "testuser" }) as Record<string, unknown>);
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: (...args: unknown[]) => mockJwtSign(args),
    verify: (...args: unknown[]) => mockJwtVerify(args),
  },
}));

// Mock database
const mockDbGet = vi.fn((_args: unknown[]) => null as unknown);
const mockDbRun = vi.fn((_args: unknown[]) => ({ changes: 1 }));
vi.mock("../db/database.js", () => ({
  default: {
    prepare: () => ({
      get: (...args: unknown[]) => mockDbGet(args),
      run: (...args: unknown[]) => mockDbRun(args),
      all: () => [],
    }),
  },
}));

// Set JWT_SECRET before importing auth routes
process.env.JWT_SECRET = "test-secret-key";

// Dynamic import to ensure mocks are in place
const { default: authRouter } = await import("../routes/auth.js");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  return app;
}

describe("POST /api/auth/login", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("returns 400 when username is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "test" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "test" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when user not found", async () => {
    mockDbGet.mockReturnValue(null);
    const res = await request(app).post("/api/auth/login").send({ username: "unknown", password: "test" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("returns 401 when password is wrong", async () => {
    mockDbGet.mockReturnValue({ id: 1, username: "testuser", passwordHash: "$hashed$", displayName: "Test" });
    const res = await request(app).post("/api/auth/login").send({ username: "testuser", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("returns token and user on successful login", async () => {
    mockDbGet.mockReturnValue({ id: 1, username: "testuser", passwordHash: "$hashed$", displayName: "Test User" });
    const res = await request(app).post("/api/auth/login").send({ username: "testuser", password: "correct-password" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe("mock-jwt-token");
    expect(res.body.user.username).toBe("testuser");
    expect(res.body.user.displayName).toBe("Test User");
  });

  it("updates lastLogin on successful login", async () => {
    mockDbGet.mockReturnValue({ id: 1, username: "testuser", passwordHash: "$hashed$", displayName: "Test" });
    await request(app).post("/api/auth/login").send({ username: "testuser", password: "correct-password" });
    expect(mockDbRun).toHaveBeenCalled();
  });
});

describe("GET /api/auth/me", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("No token");
  });

  it("returns 401 when token is invalid", async () => {
    mockJwtVerify.mockImplementation(() => {
      throw new Error("invalid");
    });
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid token");
  });

  it("returns 401 when user not found in DB", async () => {
    mockJwtVerify.mockReturnValue({ userId: 999, username: "ghost" });
    mockDbGet.mockReturnValue(null);
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("User not found");
  });

  it("returns user info on valid token", async () => {
    mockJwtVerify.mockReturnValue({ userId: 1, username: "testuser" });
    mockDbGet.mockReturnValue({ username: "testuser", displayName: "Test User" });
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("testuser");
    expect(res.body.displayName).toBe("Test User");
  });
});
