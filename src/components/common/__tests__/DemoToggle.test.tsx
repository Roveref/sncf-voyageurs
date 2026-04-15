import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mock API calls made in useEffect
vi.mock("../../../services/api", () => ({
  getDemoStatus: vi.fn().mockResolvedValue({ demo: false, hasData: false, provider: "ollama" }),
  activateDemo: vi.fn().mockResolvedValue({}),
  deactivateDemo: vi.fn().mockResolvedValue({}),
  saveChanges: vi.fn().mockResolvedValue({}),
}));

// Mock stores referenced inside toggle handler
vi.mock("../../../stores/useUserDataStore", () => ({
  useUserDataStore: Object.assign(
    vi.fn((sel: any) => sel({})),
    {
      getState: vi.fn(() => ({ setEditorStates: vi.fn() })),
    }
  ),
}));

import DemoToggle from "../DemoToggle";

describe("DemoToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<DemoToggle />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders the 'Demo' label", () => {
    render(<DemoToggle />);
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });

  it("renders the switch with correct aria-label", () => {
    render(<DemoToggle />);
    const switchEl = screen.getByLabelText("Toggle demo mode");
    expect(switchEl).toBeInTheDocument();
  });

  it("switch starts in unchecked state (demo is off by default)", async () => {
    render(<DemoToggle />);
    const switchEl = screen.getByLabelText("Toggle demo mode") as HTMLInputElement;
    // Initially false (getDemoStatus returns { demo: false })
    expect(switchEl.checked).toBe(false);
  });

  it("calls activateDemo when toggle is clicked from off state", async () => {
    const { activateDemo } = await import("../../../services/api");
    render(<DemoToggle />);
    const switchEl = screen.getByLabelText("Toggle demo mode");
    await userEvent.click(switchEl);
    expect(activateDemo).toHaveBeenCalled();
  });

  it("renders without crashing in dark mode", () => {
    const { container } = render(<DemoToggle darkMode={true} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("calls onModeChange with true when demo is activated", async () => {
    const onModeChange = vi.fn();
    render(<DemoToggle onModeChange={onModeChange} />);
    const switchEl = screen.getByLabelText("Toggle demo mode");
    await userEvent.click(switchEl);
    expect(onModeChange).toHaveBeenCalledWith(true);
  });
});
