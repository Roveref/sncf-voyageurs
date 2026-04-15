/**
 * TabRouter — Renders all tab content panels (Pipeline, Bookings, Staffing, Project, Recruitment, Custom).
 * Extracted from App.tsx. Main 3 tabs stay mounted (display:none) for widget registration.
 */

import { memo, Suspense, lazy, useLayoutEffect } from "react";
import Box from "@mui/material/Box";
import ErrorBoundary from "../common/ErrorBoundary";
import { useFilterStore } from "../../stores/useFilterStore";
import { useAppStore } from "../../stores/useAppStore";
import { useUIStore } from "../../stores/useUIStore";
import { useCrmData } from "../../queries/useCrmData";
import { useUserDataStore } from "../../stores/useUserDataStore";
import type { Opportunity } from "../../types/opportunity";

const PipelineTab = lazy(() => import("../PipelineTab"));
const BookingsTab = lazy(() => import("../BookingsTab"));
const StaffingTab = lazy(() => import("../StaffingTab"));
const JobcodeTimelineTab = lazy(() => import("../JobcodeTimelineTab"));
const RecruitmentTab = lazy(() => import("../RecruitmentTab"));
const CustomDashboard = lazy(() => import("../CustomDashboard/CustomDashboard"));

function SuspenseReadySignal({ onReady }: { onReady: () => void }) {
  useLayoutEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

interface TabRouterProps {
  activeTab: number;
  setActiveTab: (tab: number) => void;
  loading: boolean;
  darkMode: boolean;
  isPhone: boolean;
  pipelineData: Record<string, any>[];
  bookingsData: Record<string, any>[];
  filteredData: Record<string, any>[];
  allOpportunityData: Record<string, any>[];
  selectedOpportunities: Opportunity[];
  setSelectedOpportunities: (opps: Opportunity[]) => void;
  isCompleteUnitSelected: boolean;
  handleNavigateToOpportunityByJobCode: (jobNo: string) => void;
  onTabReady: () => void;
  skeletonFallback: React.ReactNode;
}

const TAB_ENTER_SX = {
  animation: "tabEnter 0.3s cubic-bezier(0.23, 1, 0.32, 1) both",
  "@keyframes tabEnter": {
    from: { opacity: 0, transform: "translateX(8px)" },
    to: { opacity: 1, transform: "translateX(0)" },
  },
};

const TabRouter = memo(
  ({
    activeTab,
    setActiveTab,
    loading,
    darkMode,
    isPhone,
    pipelineData,
    bookingsData,
    filteredData,
    allOpportunityData,
    selectedOpportunities,
    setSelectedOpportunities,
    isCompleteUnitSelected,
    handleNavigateToOpportunityByJobCode,
    onTabReady,
    skeletonFallback,
  }: TabRouterProps) => {
    const { opportunityData, filterOptions } = useCrmData();
    const showNetRevenue = useAppStore((s) => s.showNetRevenue);
    const showIO = useAppStore((s) => s.showIO);
    const showLost = useAppStore((s) => s.showLost);
    const sinceYear = useAppStore((s) => s.sinceYear);
    const editOpportunity = useUIStore((s) => s.editOpportunity);
    const setEditOpportunity = useUIStore((s) => s.setEditOpportunity);
    const navigateToOpportunityId = useUIStore((s) => s.navigateToOpportunityId);
    const filters = useFilterStore((s) => s.filters);
    const segmentModes = useFilterStore((s) => s.segmentModes);
    const serviceLineModes = useFilterStore((s) => s.serviceLineModes);

    const addOpp = useUserDataStore((s) => s.addManualOpportunity);
    const updateOpp = useUserDataStore((s) => s.updateManualOpportunity);
    const deleteOpp = useUserDataStore((s) => s.deleteManualOpportunity);

    return (
      <Box sx={{ flex: 1, overflow: isPhone ? "hidden" : "visible" }}>
        <Suspense fallback={skeletonFallback}>
          <Box sx={{ display: activeTab === 0 ? "block" : "none" }}>
            <ErrorBoundary fallbackMessage="Error in Pipeline tab">
              <PipelineTab
                data={pipelineData}
                loading={loading}
                onSelection={setSelectedOpportunities}
                selectedOpportunities={selectedOpportunities}
                showNetRevenue={showNetRevenue}
                showIO={showIO !== "off"}
                isCompleteUnitSelected={isCompleteUnitSelected}
                editOpportunity={editOpportunity}
                setEditOpportunity={setEditOpportunity}
                onOpportunityCreated={addOpp}
                onOpportunityUpdated={updateOpp}
                onOpportunityDeleted={deleteOpp}
                filterOptions={filterOptions}
                opportunityData={allOpportunityData}
                sidebarFilteredData={filteredData}
                navigateToOpportunityId={navigateToOpportunityId}
                sinceYear={sinceYear}
              />
            </ErrorBoundary>
          </Box>
          <Box sx={{ display: activeTab === 1 ? "block" : "none" }}>
            <ErrorBoundary fallbackMessage="Error in Bookings tab">
              <BookingsTab
                data={bookingsData}
                loading={loading}
                onSelection={setSelectedOpportunities as (opps: Record<string, any>[]) => void}
                selectedOpportunities={selectedOpportunities}
                showNetRevenue={showNetRevenue}
                showIO={showIO !== "off"}
                showLost={showLost}
                filters={filters}
                originalData={opportunityData}
                isCompleteUnitSelected={isCompleteUnitSelected}
                setEditOpportunity={setEditOpportunity as (opp: Record<string, any> | null) => void}
                onOpportunityCreated={addOpp as (opp: Record<string, any>) => void}
                onOpportunityDeleted={deleteOpp}
                onOpportunityUpdated={updateOpp as unknown as (opp: Record<string, any>) => void}
                navigateToOpportunityId={navigateToOpportunityId}
                sinceYear={sinceYear}
              />
            </ErrorBoundary>
          </Box>
          <Box
            sx={{
              display: activeTab === 2 ? "block" : "none",
              opacity: activeTab === 2 ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          >
            <ErrorBoundary
              fallbackMessage="Error in Staffing tab"
              onReset={() => {
                // No-op — staffing data lives in React Query cache, not in store
              }}
            >
              <StaffingTab
                sharedData={opportunityData}
                loading={loading}
                onNavigateToTab={setActiveTab}
                onNavigateToOpportunity={handleNavigateToOpportunityByJobCode}
                darkMode={darkMode}
                macroGradeFilter={filters.macroGrades}
                macroCategoryFilter={filters.macroCategories}
                segmentFilter={filters.subSegmentCodes}
                serviceLineFilter={filters.serviceLine1}
                segmentModes={segmentModes}
                serviceLineModes={serviceLineModes}
              />
            </ErrorBoundary>
          </Box>
          {activeTab === 3 && (
            <Box key="tab-3" sx={TAB_ENTER_SX}>
              <ErrorBoundary fallbackMessage="Error in Project tab">
                <JobcodeTimelineTab
                  data={opportunityData}
                  loading={loading}
                  onSelection={setSelectedOpportunities}
                  selectedOpportunities={selectedOpportunities}
                />
              </ErrorBoundary>
            </Box>
          )}
          {activeTab === 4 && (
            <Box key="tab-4" sx={TAB_ENTER_SX}>
              <ErrorBoundary fallbackMessage="Error in Recruitment tab">
                <RecruitmentTab />
              </ErrorBoundary>
            </Box>
          )}
          {activeTab === 5 && (
            <Box key="tab-5" sx={TAB_ENTER_SX}>
              <ErrorBoundary fallbackMessage="Error in Custom Dashboard">
                <CustomDashboard />
              </ErrorBoundary>
            </Box>
          )}
          <SuspenseReadySignal onReady={onTabReady} />
        </Suspense>
      </Box>
    );
  }
);

TabRouter.displayName = "TabRouter";
export default TabRouter;
