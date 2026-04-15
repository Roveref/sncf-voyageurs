import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mock auth store
vi.mock("../../../stores/useAuthStore", () => ({
  useAuthStore: vi.fn((sel: any) => sel({ setAuth: vi.fn() })),
}));

// Mock fetch (login API call)
const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

import LoginPage from "../LoginPage";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ token: "test-token", user: { username: "admin", displayName: "Admin" } }),
    });
  });

  it("renders without crashing", () => {
    const { container } = render(<LoginPage />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders the dashboard title", () => {
    render(<LoginPage />);
    expect(screen.getByText("B. Dashboard")).toBeInTheDocument();
  });

  it("renders Username input field", () => {
    render(<LoginPage />);
    // MUI TextField label connects via htmlFor/id generated at runtime
    // Use placeholder text or role instead
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders Password input field", () => {
    render(<LoginPage />);
    // password inputs don't have role "textbox" — query by type
    const passwordInput = document.querySelector("input[type='password']") as HTMLInputElement;
    expect(passwordInput).not.toBeNull();
  });

  it("renders Sign in button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /Sign in/i })).toBeInTheDocument();
  });

  it("password field type is password", () => {
    render(<LoginPage />);
    const passwordInput = document.querySelector("input[type='password']") as HTMLInputElement;
    expect(passwordInput).not.toBeNull();
    expect(passwordInput.type).toBe("password");
  });

  it("updates username field on type", async () => {
    render(<LoginPage />);
    const usernameInput = screen.getByRole("textbox") as HTMLInputElement;
    await userEvent.type(usernameInput, "testuser");
    expect(usernameInput.value).toBe("testuser");
  });

  it("updates password field on type", async () => {
    render(<LoginPage />);
    const passwordInput = document.querySelector("input[type='password']") as HTMLInputElement;
    await userEvent.type(passwordInput, "secret");
    expect(passwordInput.value).toBe("secret");
  });

  it("calls fetch with login endpoint on form submit", async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByRole("textbox"), "admin");
    await userEvent.type(document.querySelector("input[type='password']")!, "password");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/i }));
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("shows error message when login fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: "Invalid credentials" }),
    });
    render(<LoginPage />);
    await userEvent.type(screen.getByRole("textbox"), "wrong");
    await userEvent.type(document.querySelector("input[type='password']")!, "wrong");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/i }));
    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  it("shows network error when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    render(<LoginPage />);
    await userEvent.type(screen.getByRole("textbox"), "admin");
    await userEvent.type(document.querySelector("input[type='password']")!, "pass");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/i }));
    expect(await screen.findByText("Cannot reach server")).toBeInTheDocument();
  });
});
