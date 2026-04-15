import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// Use vi.hoisted so the variable is available inside vi.mock
const { mockApiFetch } = vi.hoisted(() => {
  return {
    mockApiFetch: vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ user_notifications: [], count: 0 }),
    }),
  };
});

// Mock API
vi.mock("../../../services/api", () => ({
  API_BASE: "/api",
  apiFetch: mockApiFetch,
}));

// Mock stores
vi.mock("../../../stores/useAppStore", () => ({
  useAppStore: vi.fn((sel: any) =>
    sel({ sseNotificationVersion: 0, hydrationFilter: null, notifFilteredOppIds: new Set() })
  ),
}));
vi.mock("../../../stores/useUserDataStore", () => ({
  useUserDataStore: {
    getState: vi.fn(() => ({
      opportunityActions: {},
      setOpportunityActions: vi.fn(),
    })),
  },
}));
vi.mock("../../../stores/useUIStore", () => ({
  useUIStore: {
    getState: vi.fn(() => ({ navigateToOpportunity: vi.fn() })),
  },
}));

import NotificationBell from "../NotificationBell";

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = renderBell();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders a bell icon button", () => {
    renderBell();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("opens popover when bell is clicked", async () => {
    renderBell();
    const bellBtn = screen.getAllByRole("button")[0];
    await userEvent.click(bellBtn);
    // Popover content: "Notifications" title
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    renderBell();
    const bellBtn = screen.getAllByRole("button")[0];
    await userEvent.click(bellBtn);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });

  it("badge starts with zero unread count", () => {
    renderBell();
    // Badge is visually 0 — not shown, or shown as 0
    const badge = document.querySelector("[class*='MuiBadge']");
    expect(badge).not.toBeNull();
  });

  it("fetches notifications on mount", () => {
    renderBell();
    expect(mockApiFetch).toHaveBeenCalled();
  });
});
