import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mock stores
vi.mock("../../../../../stores/useScenarioStore", () => ({
  default: vi.fn((sel: any) =>
    sel({
      scenarios: [],
      activeScenarioId: null,
      setActiveScenario: vi.fn(),
      deleteScenario: vi.fn(),
      duplicateScenario: vi.fn(),
    })
  ),
}));
vi.mock("../../../../../stores/useUserDataStore", () => ({
  useUserDataStore: vi.fn((sel: any) => sel({ setEditorStates: vi.fn() })),
}));

import ScenarioSelector from "../ScenarioSelector";

function renderSelector(props: Partial<React.ComponentProps<typeof ScenarioSelector>> = {}) {
  return render(<ScenarioSelector onCreateClick={vi.fn()} {...props} />);
}

describe("ScenarioSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = renderSelector();
    expect(container.firstChild).not.toBeNull();
  });

  it("shows 'Actual data' chip when no active scenario", () => {
    renderSelector();
    expect(screen.getByText("Actual data")).toBeInTheDocument();
  });

  it("shows scenario name chip when a scenario is active", async () => {
    const useScenarioStore = (await import("../../../../../stores/useScenarioStore")).default;
    vi.mocked(useScenarioStore).mockImplementation((sel: any) =>
      sel({
        scenarios: [{ id: "sc1", name: "My Scenario" }],
        activeScenarioId: "sc1",
        setActiveScenario: vi.fn(),
        deleteScenario: vi.fn(),
        duplicateScenario: vi.fn(),
      })
    );
    renderSelector();
    expect(screen.getByText("My Scenario")).toBeInTheDocument();
  });

  it("opens popover when chip is clicked", async () => {
    renderSelector();
    // MUI Chip — click on the chip element itself
    const chip = document.querySelector("[class*='MuiChip-root']") as HTMLElement;
    if (chip) await userEvent.click(chip);
    // Popover content becomes visible
    expect(screen.getByText("New scenario")).toBeInTheDocument();
  });

  it("shows a Create scenario button in the popover", async () => {
    renderSelector();
    const chip = document.querySelector("[class*='MuiChip-root']") as HTMLElement;
    if (chip) await userEvent.click(chip);
    expect(screen.getByText("New scenario")).toBeInTheDocument();
  });

  it("calls onCreateClick when Create is clicked in popover", async () => {
    const onCreateClick = vi.fn();
    renderSelector({ onCreateClick });
    const chip = document.querySelector("[class*='MuiChip-root']") as HTMLElement;
    if (chip) await userEvent.click(chip);
    const createBtn = screen.getByText("New scenario");
    await userEvent.click(createBtn);
    expect(onCreateClick).toHaveBeenCalled();
  });
});
