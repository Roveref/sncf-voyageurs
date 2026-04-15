import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// Mock facade hooks
vi.mock("../../../queries/useStaffingStatus", () => ({
  useStaffingStatus: () => ({ hasStaffingData: false }),
}));
// Mock stores
// Note: useDataStore was removed; if a transitive dependency needs useComputedStore, add mock here
vi.mock("../../../stores/useLoadingStore", () => ({
  useLoadingStore: vi.fn((sel: any) => sel({ loading: false })),
}));
vi.mock("../../../stores/useAppStore", () => ({
  useAppStore: vi.fn((sel: any) =>
    sel({
      showIO: "off",
      toggleIO: vi.fn(),
      showLost: false,
      toggleLost: vi.fn(),
      showNetRevenue: false,
      toggleNetRevenue: vi.fn(),
      modificationsEnabled: "all",
      setModificationsEnabled: vi.fn(),
      liveChangedOppIds: new Set(),
      liveRevenueDelta: 0,
      liveFilterActive: false,
    })
  ),
}));
vi.mock("../../../stores/useUIStore", () => ({
  useUIStore: vi.fn((sel: any) => sel({ setEditOpportunity: vi.fn(), toggleStaffingDebug: vi.fn() })),
}));
vi.mock("../../../stores/useUserDataStore", () => ({
  useUserDataStore: vi.fn((sel: any) =>
    sel({
      deleteManualOpportunity: vi.fn(),
      updateManualOpportunity: vi.fn(),
      addManualOpportunity: vi.fn(),
      manualAccounts: [],
      deleteManualAccount: vi.fn(),
      clearAllManualOpportunities: vi.fn(),
      clearAllManualAccounts: vi.fn(),
      addManualAccount: vi.fn(),
    })
  ),
}));
// Mock child components that have their own store deps
vi.mock("../../common/NotificationBell", () => ({
  default: () => <button aria-label="Notifications">Bell</button>,
}));
vi.mock("../../StatusOverrideManager", () => ({
  default: () => <div data-testid="status-override-manager" />,
}));

import AppBarActions from "../AppBarActions";

function renderActions(props: Partial<React.ComponentProps<typeof AppBarActions>> = {}) {
  return render(
    <MemoryRouter>
      <AppBarActions
        dataReady={true}
        activeTab={0}
        allOpportunityData={[]}
        setActiveTab={vi.fn()}
        onSettingsOpen={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe("AppBarActions", () => {
  it("renders without crashing", () => {
    const { container } = renderActions();
    expect(container.firstChild).not.toBeNull();
  });

  it("renders I&O toggle switch when dataReady", () => {
    renderActions({ dataReady: true });
    const ioSwitch = screen.getByLabelText("Toggle I&O display");
    expect(ioSwitch).toBeInTheDocument();
  });

  it("renders Net Revenue toggle switch when dataReady", () => {
    renderActions({ dataReady: true });
    const netRevSwitch = screen.getByLabelText(/Switch to (Net|Gross) Revenue/);
    expect(netRevSwitch).toBeInTheDocument();
  });

  it("renders Settings button when dataReady", () => {
    renderActions({ dataReady: true });
    const settingsBtn = screen.getByLabelText("Open settings");
    expect(settingsBtn).toBeInTheDocument();
  });

  it("shows Lost toggle only on Bookings tab (activeTab 1)", () => {
    renderActions({ activeTab: 1 });
    const lostSwitch = screen.getByLabelText(/Switch to (Bookings|Lost) view/);
    expect(lostSwitch).toBeInTheDocument();
  });

  it("does not show Lost toggle on Pipeline tab (activeTab 0)", () => {
    renderActions({ activeTab: 0 });
    const lostSwitch = screen.queryByLabelText(/Switch to (Bookings|Lost) view/);
    expect(lostSwitch).not.toBeInTheDocument();
  });

  it("renders nothing visible when dataReady is false", () => {
    renderActions({ dataReady: false });
    // With visibility:hidden, element is in DOM but switches won't be accessible
    const ioSwitch = screen.queryByLabelText("Toggle I&O display");
    expect(ioSwitch).not.toBeInTheDocument();
  });
});
