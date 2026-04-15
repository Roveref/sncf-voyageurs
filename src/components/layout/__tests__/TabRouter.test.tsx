import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// Mock heavy lazy-loaded tab components
vi.mock("../../PipelineTab", () => ({ default: () => <div data-testid="pipeline-tab">PipelineTab</div> }));
vi.mock("../../BookingsTab", () => ({ default: () => <div data-testid="bookings-tab">BookingsTab</div> }));
vi.mock("../../StaffingTab", () => ({ default: () => <div data-testid="staffing-tab">StaffingTab</div> }));
vi.mock("../../JobcodeTimelineTab", () => ({ default: () => <div data-testid="jobcode-tab">JobcodeTab</div> }));
vi.mock("../../RecruitmentTab", () => ({ default: () => <div data-testid="recruitment-tab">RecruitmentTab</div> }));
vi.mock("../../CustomDashboard/CustomDashboard", () => ({
  default: () => <div data-testid="custom-dashboard">CustomDashboard</div>,
}));

// Mock stores
vi.mock("../../../stores/useFilterStore", () => ({
  useFilterStore: vi.fn((sel: any) =>
    sel({
      filters: { macroGrades: [], macroCategories: [], subSegmentCodes: [], serviceLine1: [] },
      segmentModes: {},
      serviceLineModes: {},
    })
  ),
}));
vi.mock("../../../stores/useAppStore", () => ({
  useAppStore: vi.fn((sel: any) => sel({ showNetRevenue: false, showIO: "off", showLost: false, sinceYear: null })),
}));
vi.mock("../../../stores/useUIStore", () => ({
  useUIStore: vi.fn((sel: any) =>
    sel({ editOpportunity: null, setEditOpportunity: vi.fn(), navigateToOpportunityId: null })
  ),
}));
vi.mock("../../../queries/useCrmData", () => ({
  useCrmData: () => ({
    opportunityData: [],
    crmAccounts: [],
    crmContacts: [],
    filterOptions: { subSegmentCodes: [], subSegments: [], serviceLine1: [], serviceOfferings: [], accounts: [] },
    segmentToSubSegmentMap: {},
    serviceToOfferingMap: {},
    statusOptions: [],
    isLoading: false,
    isSuccess: true,
  }),
}));
vi.mock("../../../stores/useUserDataStore", () => ({
  useUserDataStore: vi.fn((sel: any) =>
    sel({ addManualOpportunity: vi.fn(), updateManualOpportunity: vi.fn(), deleteManualOpportunity: vi.fn() })
  ),
}));

import TabRouter from "../TabRouter";

const baseProps = {
  activeTab: 0,
  setActiveTab: vi.fn(),
  loading: false,
  darkMode: false,
  isPhone: false,
  pipelineData: [],
  bookingsData: [],
  filteredData: [],
  allOpportunityData: [],
  selectedOpportunities: [],
  setSelectedOpportunities: vi.fn(),
  isCompleteUnitSelected: false,
  handleNavigateToOpportunityByJobCode: vi.fn(),
  onTabReady: vi.fn(),
  skeletonFallback: <div>Loading…</div>,
};

function renderTabRouter(props = {}) {
  return render(
    <MemoryRouter>
      <TabRouter {...baseProps} {...props} />
    </MemoryRouter>
  );
}

describe("TabRouter", () => {
  it("renders without crashing", () => {
    const { container } = renderTabRouter();
    expect(container.firstChild).not.toBeNull();
  });

  it("shows Pipeline tab content when activeTab is 0", async () => {
    renderTabRouter({ activeTab: 0 });
    expect(await screen.findByTestId("pipeline-tab")).toBeInTheDocument();
  });

  it("shows Bookings tab content when activeTab is 1", async () => {
    renderTabRouter({ activeTab: 1 });
    expect(await screen.findByTestId("bookings-tab")).toBeInTheDocument();
  });

  it("shows Staffing tab content when activeTab is 2", async () => {
    renderTabRouter({ activeTab: 2 });
    expect(await screen.findByTestId("staffing-tab")).toBeInTheDocument();
  });

  it("shows Jobcode tab only when activeTab is 3", async () => {
    renderTabRouter({ activeTab: 3 });
    expect(await screen.findByTestId("jobcode-tab")).toBeInTheDocument();
  });

  it("shows Recruitment tab only when activeTab is 4", async () => {
    renderTabRouter({ activeTab: 4 });
    expect(await screen.findByTestId("recruitment-tab")).toBeInTheDocument();
  });

  it("shows Custom Dashboard only when activeTab is 5", async () => {
    renderTabRouter({ activeTab: 5 });
    expect(await screen.findByTestId("custom-dashboard")).toBeInTheDocument();
  });
});
