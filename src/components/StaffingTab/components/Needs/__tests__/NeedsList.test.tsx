import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// Use vi.hoisted so the variable is available in vi.mock factory
const { mockStaffingNeeds } = vi.hoisted(() => ({
  mockStaffingNeeds: { current: {} as Record<string, any[]> },
}));

// Mock stores
vi.mock("../../../../../stores/useUserDataStore", () => {
  const getState = vi.fn(() => ({ editorStates: {}, setEditorState: vi.fn() }));
  const hook = Object.assign(
    vi.fn((sel: any) => sel({ staffingNeeds: mockStaffingNeeds.current, editorStates: {} })),
    { getState }
  );
  return { useUserDataStore: hook };
});

// Mock CandidateDrawer (it has its own heavy deps)
vi.mock("../CandidateDrawer", () => ({
  default: ({ needId }: any) => <div data-testid="candidate-drawer" data-needid={needId} />,
}));

import NeedsList from "../NeedsList";

function renderNeedsList(overrides: Record<string, any> = {}) {
  return render(<NeedsList {...overrides} />);
}

describe("NeedsList", () => {
  beforeEach(() => {
    mockStaffingNeeds.current = {};
  });

  it("renders without crashing", () => {
    const { container } = renderNeedsList();
    expect(container.firstChild).not.toBeNull();
  });

  it("shows empty state when no needs are defined", () => {
    renderNeedsList();
    expect(screen.getByText("No needs defined")).toBeInTheDocument();
  });

  it("shows filtered empty state when gradeFilter is active with no matching needs", () => {
    renderNeedsList({ gradeFilter: "Manager" });
    expect(screen.getByText("No needs for this filter")).toBeInTheDocument();
  });

  it("shows grade chip when gradeFilter is provided", () => {
    renderNeedsList({ gradeFilter: "Senior Consultant" });
    const chips = document.querySelectorAll("[class*='MuiChip']");
    expect(chips.length).toBeGreaterThan(0);
  });

  it("renders needs grouped by grade when store has data", () => {
    // Set mock data via the hoisted ref before render
    mockStaffingNeeds.current = {
      "OPP-001": [
        {
          id: "need-1",
          opportunityId: "OPP-001",
          grade: "Manager",
          quantity: 1,
          startDate: "2025-01-01",
          endDate: "2025-06-30",
          utilization: 100,
        },
      ],
    };
    renderNeedsList();
    // Manager group header should appear
    expect(screen.getByText("Manager")).toBeInTheDocument();
  });

  it("renders candidate drawer when a matching need exists with candidateNeedId", () => {
    // CandidateDrawer renders only when selectedNeed && candidateNeedId
    mockStaffingNeeds.current = {
      "OPP-001": [
        {
          id: "need-1",
          opportunityId: "OPP-001",
          grade: "Manager",
          quantity: 1,
          startDate: "2025-01-01",
          endDate: "2025-06-30",
        },
      ],
    };
    renderNeedsList({ candidateNeedId: "need-1" });
    expect(screen.getByTestId("candidate-drawer")).toBeInTheDocument();
  });
});
