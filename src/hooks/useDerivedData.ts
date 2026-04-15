import { useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import { useComputedStore } from "../stores/useComputedStore";
import { useCrmData } from "../queries/useCrmData";
import { useUserDataStore } from "../stores/useUserDataStore";
import { useMergedEmployeeData } from "./useMergedEmployeeData";
import { applyAllFilters } from "../utils/filterUtils";
import { calculateRevenueWithSegmentLogic } from "../utils/dataUtils";
import type { Filters } from "../utils/filterHelpers";

/**
 * Computes derived data (allOpportunityData, filteredData, tabData) from stores.
 * Replaces the complex useMemo chains that were previously in App.tsx.
 */
export function useDerivedData(
  filters: Filters,
  filterMode: string,
  activeTab: number,
  segmentModes?: Map<string, "team" | "both">,
  serviceLineModes?: Map<string, "team" | "both">,
  globalSearchText = ""
) {
  const { opportunityData, serviceToOfferingMap } = useCrmData();
  const modificationsEnabled = useAppStore((s) => s.modificationsEnabled);
  const showIO = useAppStore((s) => s.showIO);
  const showNetRevenue = useAppStore((s) => s.showNetRevenue);
  const staffingEmployees = useComputedStore((s) => s.staffingEmployees);
  const { mergedMetadata: employeeMetadata } = useMergedEmployeeData();

  const staffingIndexVersion = useComputedStore((s) => s.staffingIndexVersion);
  const statusOverrides = useUserDataStore((s) => s.statusOverrides);
  const manualOpportunitiesFromStore = useUserDataStore((s) => s.manualOpportunities);
  const revenueTeamMap = useUserDataStore((s) => s.revenueTeam);
  const opportunityActions = useUserDataStore((s) => s.opportunityActions);
  const staffingNeedsFromStore = useUserDataStore((s) => s.staffingNeeds);

  // Build person→segment/serviceLine mapping from staffing employees,
  // with fallback to employeeMetadata when StaffingTab hasn't been visited yet
  const personToSegmentMap = useMemo(() => {
    const map = new Map<string, { segment: string; serviceLine?: string }>();
    if (staffingEmployees.length > 0) {
      staffingEmployees.forEach((emp: any) => {
        if (emp.name) {
          map.set(emp.name.trim().toLowerCase(), {
            segment: emp.subTeam || "",
            serviceLine: emp.serviceLine || "",
          });
        }
      });
    } else {
      // Fallback: build from employeeMetadata (available before StaffingTab mounts)
      Object.values(employeeMetadata).forEach((meta: any) => {
        if (meta.name) {
          map.set(meta.name.trim().toLowerCase(), {
            segment: meta.segment || meta.team || "",
            serviceLine: meta.serviceLine || "",
          });
        }
      });
    }
    return map;
  }, [staffingEmployees, employeeMetadata]);

  // Derive I&O team member names from staffing employees
  const IO_TEAMS = ["IEM", "AUTO", "Operations", "LSC"];
  const ioTeamNames = useMemo(() => {
    const names = new Set<string>();
    staffingEmployees.forEach((emp: any) => {
      if (emp.name && IO_TEAMS.includes(emp.subTeam)) {
        names.add(emp.name.trim().toLowerCase());
      }
    });
    return names;
  }, [staffingEmployees]);

  // Merge manual opportunities + status overrides with uploaded data
  const allOpportunityData = useMemo(() => {
    if (opportunityData.length === 0) return [] as any[];

    if (modificationsEnabled === "off") return opportunityData;

    const combinedData = [...opportunityData, ...manualOpportunitiesFromStore];

    const withOverrides =
      Object.keys(statusOverrides).length > 0
        ? combinedData.map((opp) => {
            const opportunityId = opp.opportunityId;
            const override = statusOverrides[opportunityId];
            if (override && !override._reverted) {
              const updatedOpp = {
                ...opp,
                _originalStatus: opp.status,
                _originalBookingDate: opp.bookingDate,
                status: override.newStatus,
                _statusOverride: override,
              };
              if ((override.newStatus === 14 || override.newStatus === 15) && override.bookingDate) {
                updatedOpp.bookingDate = override.bookingDate;
              }
              return updatedOpp;
            }
            return opp;
          })
        : combinedData;

    if (modificationsEnabled === "all") return withOverrides;

    // "changes" mode: only modified / annotated opportunities
    const idsWithNotes = new Set<string>();
    for (const [id, items] of Object.entries(opportunityActions)) {
      if (items.length > 0) idsWithNotes.add(id);
    }
    for (const [id, items] of Object.entries(staffingNeedsFromStore)) {
      if (items.length > 0) idsWithNotes.add(id);
    }

    return withOverrides.filter(
      (opp) => opp.isManual || opp._statusOverride || idsWithNotes.has(String(opp.opportunityId))
    );
  }, [
    opportunityData,
    manualOpportunitiesFromStore,
    statusOverrides,
    modificationsEnabled,
    opportunityActions,
    staffingNeedsFromStore,
  ]);

  // Apply filters
  const filteredDataRaw = useMemo(() => {
    let result = applyAllFilters(
      allOpportunityData,
      filters,
      filterMode,
      serviceToOfferingMap,
      segmentModes,
      serviceLineModes,
      personToSegmentMap,
      revenueTeamMap
    );

    // Global search text — filters entire dashboard (charts, insights, list)
    if (globalSearchText.trim()) {
      const lower = globalSearchText.trim().toLowerCase();
      result = result.filter((item: any) => {
        const fields = [
          item.opportunity,
          item.account,
          item.opportunityId,
          item.jobCode,
          item.manager,
          item.partner,
          item.em,
          item.ep,
        ];
        return fields.some((f) => f != null && String(f).toLowerCase().includes(lower));
      });
    }

    return result;
  }, [
    allOpportunityData,
    filters,
    filterMode,
    serviceToOfferingMap,
    segmentModes,
    serviceLineModes,
    personToSegmentMap,
    revenueTeamMap,
    globalSearchText,
  ]);

  // Apply live CRM changes filter (when user clicks the delta indicator)
  const liveFilterActive = useAppStore((s) => s.liveFilterActive);
  const liveChangedOppIds = useAppStore((s) => s.liveChangedOppIds);
  const filteredByLive = useMemo(() => {
    if (!liveFilterActive || liveChangedOppIds.size === 0) return filteredDataRaw;
    return filteredDataRaw.filter((opp: any) => liveChangedOppIds.has(String(opp.opportunityId)));
  }, [filteredDataRaw, liveFilterActive, liveChangedOppIds]);

  // Apply I&O Only / I&O Team filter
  const filteredData = useMemo(() => {
    if (showIO === "ioOnly") {
      return filteredByLive.filter((opp) => {
        const ioAmount = calculateRevenueWithSegmentLogic(opp, showNetRevenue);
        return ioAmount > 0;
      });
    }
    if (showIO === "ioTeam" || showIO === "ioLead") {
      if (ioTeamNames.size === 0) return filteredByLive;
      const checkStaffing = showIO === "ioTeam";
      let staffingIndex: Record<string, { name: string }[]> = {};
      if (checkStaffing) {
        try {
          const raw = localStorage.getItem("staffing_employee_index");
          if (raw) staffingIndex = JSON.parse(raw);
        } catch {
          /* ignore */
        }
      }
      return filteredByLive.filter((opp) => {
        const personFields = [opp.manager, opp.partner, opp.em, opp.ep];
        if (personFields.some((n) => n && ioTeamNames.has(String(n).trim().toLowerCase()))) return true;
        if (!checkStaffing) return false;
        const keys: string[] = [];
        const jc = opp.jobCode;
        if (jc) keys.push(String(jc).trim());
        const opportunityId = opp.opportunityId;
        if (opportunityId) keys.push(String(opportunityId).trim());
        for (const key of keys) {
          const entries = staffingIndex[key];
          if (entries?.some((e) => e.name && ioTeamNames.has(e.name.trim().toLowerCase()))) return true;
        }
        return false;
      });
    }
    return filteredByLive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredByLive, showIO, showNetRevenue, ioTeamNames, staffingIndexVersion]);

  // Tab-specific data
  const tabData = useMemo(() => {
    if (!filteredData || !Array.isArray(filteredData)) return [];
    if (activeTab === 0) return filteredData.filter((item) => item.status >= 1 && item.status <= 11);
    if (activeTab === 1) return filteredData.filter((item) => [11, 14, 15].includes(item.status));
    if (activeTab === 2) return filteredData;
    return [];
  }, [filteredData, activeTab]);

  // Per-tab data (always computed, not dependent on activeTab)
  const pipelineData = useMemo(
    () => filteredData?.filter((item: any) => item.status >= 1 && item.status <= 11) || [],
    [filteredData]
  );
  const bookingsData = useMemo(
    () => filteredData?.filter((item: any) => [11, 14, 15].includes(item.status)) || [],
    [filteredData]
  );

  return { allOpportunityData, filteredData, filteredDataRaw, tabData, pipelineData, bookingsData };
}
