import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mock stores with both hook call and static getState
vi.mock("../../../stores/useUserDataStore", () => {
  const getState = vi.fn(() => ({
    statusOverrides: {},
    opportunityActions: {},
    staffingNeeds: {},
    setAllOpportunityActions: vi.fn(),
    setAllStaffingNeeds: vi.fn(),
    setStaffingNeeds: vi.fn(),
    setOpportunityActions: vi.fn(),
    deleteOverride: vi.fn(),
    removeManualEmployee: vi.fn(),
  }));
  const hook = vi.fn((sel: any) =>
    sel({
      statusOverrides: {},
      removeStatusOverride: vi.fn(),
      clearAllStatusOverrides: vi.fn(),
      setStatusOverride: vi.fn(),
      opportunityActions: {},
      staffingNeeds: {},
      setAllOpportunityActions: vi.fn(),
      setAllStaffingNeeds: vi.fn(),
      employeeOverrides: {},
      manualEmployees: [],
    })
  );
  const hookWithState = Object.assign(hook, { getState });
  return { useUserDataStore: hookWithState };
});

vi.mock("../../../hooks/useMergedEmployeeData", () => ({
  useMergedEmployeeData: vi.fn(() => ({
    mergedMetadata: {},
    manualEmployees: [],
    holidays: [],
    isReady: true,
    isLoading: false,
  })),
}));

vi.mock("../../../stores/useScenarioStore", () => ({
  default: vi.fn((sel: any) => sel({ scenarios: [] })),
}));
vi.mock("../../../stores/useAppStore", () => ({
  useAppStore: vi.fn((sel: any) => sel({ filteredOppIds: new Set() })),
}));
vi.mock("../../../stores/helpers", () => ({
  deleteScenarioWithCleanup: vi.fn(),
}));

// Mock sub-components that open dialogs
vi.mock("../ManagementDialog", () => ({
  default: ({ open, activeTab }: any) =>
    open ? (
      <div data-testid="management-dialog">
        <div data-testid="active-tab">{activeTab}</div>
      </div>
    ) : null,
}));
vi.mock("../ResultDialog", () => ({ default: () => null }));
vi.mock("../GroupSettingsDialog", () => ({ default: () => null }));
vi.mock("../OpportunityPopup", () => ({ default: () => null }));
vi.mock("../useImportExport", () => ({
  useImportExport: vi.fn(() => ({
    importResult: null,
    setImportResult: vi.fn(),
    isImporting: false,
    copied: false,
    fileInputRef: { current: null },
    handleCopyReport: vi.fn(),
    handleDownloadReport: vi.fn(),
    handleExportJSON: vi.fn(),
    handleImportFile: vi.fn(),
  })),
}));

import StatusOverrideManager from "../StatusOverrideManager";

function renderManager(props: Record<string, any> = {}) {
  return render(
    <StatusOverrideManager
      opportunityData={[]}
      onDeleteManualOpportunity={vi.fn()}
      onManualOpportunityUpdated={vi.fn()}
      onAddManualOpportunity={vi.fn()}
      manualAccounts={[]}
      onDeleteManualAccount={vi.fn()}
      onClearAllManualOpportunities={vi.fn()}
      onClearAllManualAccounts={vi.fn()}
      onAddManualAccount={vi.fn()}
      showNetRevenue={false}
      showIO={true}
      setEditOpportunity={vi.fn()}
      modificationsEnabled="all"
      onToggleModifications={vi.fn()}
      {...props}
    />
  );
}

describe("StatusOverrideManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = renderManager();
    expect(container).not.toBeNull();
  });

  it("renders the HeaderToggles switch", () => {
    renderManager();
    const switchEl = document.querySelector("[class*='MuiSwitch']");
    expect(switchEl).not.toBeNull();
  });

  it("shows 'Inc. Changes' label when modificationsEnabled is 'all'", () => {
    renderManager({ modificationsEnabled: "all" });
    expect(screen.getByText("Inc. Changes")).toBeInTheDocument();
  });

  it("shows 'Exc. Changes' label when modificationsEnabled is 'off'", () => {
    renderManager({ modificationsEnabled: "off" });
    expect(screen.getByText("Exc. Changes")).toBeInTheDocument();
  });

  it("shows 'Changes Only' label when modificationsEnabled is 'changes'", () => {
    renderManager({ modificationsEnabled: "changes" });
    expect(screen.getByText("Changes Only")).toBeInTheDocument();
  });

  it("opens management dialog when label is clicked (non-off mode)", async () => {
    renderManager({ modificationsEnabled: "all" });
    const label = screen.getByText("Inc. Changes");
    await userEvent.click(label);
    expect(screen.getByTestId("management-dialog")).toBeInTheDocument();
  });
});
