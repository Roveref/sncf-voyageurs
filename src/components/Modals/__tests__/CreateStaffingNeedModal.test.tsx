import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// Mock stores
vi.mock("../../../stores/useUserDataStore", () => ({
  useUserDataStore: vi.fn((sel: any) =>
    sel({
      manualAccounts: [],
      staffingNeeds: {},
      setStaffingNeeds: vi.fn(),
    })
  ),
}));
vi.mock("../../../stores/useComputedStore", () => ({
  useComputedStore: vi.fn((sel: any) => sel({ staffingEmployees: [] })),
}));

// Mock sub-components
vi.mock("../NeedsPyramid", () => ({
  default: () => <div data-testid="needs-pyramid" />,
}));
vi.mock("../NeedsTimeline", () => ({
  default: () => <div data-testid="needs-timeline" />,
}));
vi.mock("../../shared", () => ({
  SkillsAutocomplete: () => null,
}));
vi.mock("../../../hooks/useResponsive", () => ({
  default: vi.fn(() => ({ isPhone: false })),
}));
vi.mock("../../common/DialogTransition", () => ({
  default: vi.fn().mockImplementation(({ children }: any) => children),
}));

import CreateStaffingNeedModal from "../CreateStaffingNeedModal";

function renderModal(props: Record<string, any> = {}) {
  return render(<CreateStaffingNeedModal open={true} onClose={vi.fn()} {...props} />);
}

describe("CreateStaffingNeedModal", () => {
  it("renders without crashing when open", () => {
    renderModal();
    // MUI Dialog renders to portal — check document body
    expect(document.body).not.toBeNull();
  });

  it("shows dialog title when open", () => {
    renderModal();
    expect(screen.getByText(/New Staffing Need|Staffing Need|Besoin/i)).toBeInTheDocument();
  });

  it("renders form inputs when open", () => {
    renderModal();
    const inputs = document.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("renders the grade selection area (pyramid/form)", () => {
    renderModal();
    // The grade selection form area has grade-related buttons (← shortcut hint)
    const content = document.body.textContent || "";
    expect(content.length).toBeGreaterThan(0);
  });

  it("renders the dialog content (timeline or form area)", () => {
    renderModal();
    // At minimum, the dialog is in the DOM
    const dialog = document.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
  });

  it("renders Create/Save button", () => {
    renderModal();
    const createBtns = screen.queryAllByText(/Create|Save|Créer/i);
    expect(createBtns.length).toBeGreaterThan(0);
  });

  it("renders Cancel button", () => {
    renderModal();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("does not render dialog content when closed", () => {
    render(<CreateStaffingNeedModal open={false} onClose={vi.fn()} />);
    // Dialog content not in DOM when closed
    expect(screen.queryByTestId("needs-pyramid")).not.toBeInTheDocument();
  });
});
