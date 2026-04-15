/**
 * useHydration — React Query replacement for useBackendHydration.
 *
 * Composes individual query hooks and bridges results into existing Zustand stores.
 * Returns the same interface as the legacy useBackendHydration so App.tsx swap is transparent.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { setHydrationProgressListener } from "../services/api";
import { useHealthQuery } from "../queries/useHealthQuery";
import { useReadyQuery } from "../queries/useReadyQuery";
import { useRegionsQuery } from "../queries/useRegionsQuery";
import { useCrmQuery } from "../queries/useCrmQuery";
import { useStaffingQuery } from "../queries/useStaffingQuery";
import { useSapQuery } from "../queries/useSapQuery";
import { useMetadataQuery } from "../queries/useMetadataQuery";
import { useSkillsQuery } from "../queries/useSkillsQuery";
import { useChangesQuery } from "../queries/useChangesQuery";
import { useRecruitmentQuery } from "../queries/useRecruitmentQuery";
import { useSkillsCatalogQuery } from "../queries/useSkillsCatalogQuery";
import { useEmployeesQuery } from "../queries/useEmployeesQuery";
import type { CrmFilter } from "../queries/queryKeys";

// useEmployeeMetadataStore bridge removed — consumers use useMergedEmployeeData() directly
// useCrmStore bridge removed — consumers use useCrmData() directly
// useRecruitmentStore bridge removed — consumers use useRecruitmentData() directly

import { restoreUserChanges } from "../utils/restoreUserChanges";
import { updateAutoSaveBaseline } from "./useAutoSave";

import { useAppStore } from "../stores/useAppStore";
import { updateStatusOptionsFromOptionSet } from "../utils/statusOptions";
import { STATUS_TEXT, updateSpecialSegmentCodes } from "../utils/constants";
import { fLog, fWarn } from "../utils/logger";
import {
  GRADE_ABBR,
  updateTuThresholds,
  updateMdsExtractStart,
  updatePublicHolidays,
  applyGradeConfig,
  applyCategoryConfig,
} from "../components/StaffingTab/constants";
import { GRADE_TARGETS } from "../components/StaffingTab/constants/theme";
import { applyBrandConfig } from "../config/brandConfig";

export interface RegionData {
  name: string;
  countries: string[];
}

export interface HydrationFilter {
  region?: string;
  country?: string;
  since?: string;
}

export interface UseHydrationReturn {
  hydrating: boolean;
  hydrated: boolean;
  backendAvailable: boolean;
  error: string | null;
  hydrationPercent: number;
  startHydration: (filter?: HydrationFilter) => void;
  regions: RegionData[];
  loadingRegions: boolean;
}

export function useHydration(): UseHydrationReturn {
  // ── Filter state — single source of truth in useAppStore ──
  const filter = useAppStore((s) => s.hydrationFilter);

  // ── Core queries ──
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;

  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true;

  const regionsQuery = useRegionsQuery(backendAvailable);

  // ── Data queries (fire in parallel once ready) ──
  const crmQuery = useCrmQuery(filter, isReady);
  const staffingQuery = useStaffingQuery(isReady);
  const sapQuery = useSapQuery(isReady);
  const metadataQuery = useMetadataQuery(isReady);
  const skillsQuery = useSkillsQuery(isReady);

  // ── Changes query (waits for data queries) ──
  const allDataSuccess =
    metadataQuery.isSuccess && sapQuery.isSuccess && skillsQuery.isSuccess && staffingQuery.isSuccess;
  const changesQuery = useChangesQuery(allDataSuccess);

  // ── Non-blocking queries ──
  const recruitmentQuery = useRecruitmentQuery(isReady);
  const skillsCatalogQuery = useSkillsCatalogQuery(isReady);

  // ── Enriched employees query (server-side pipeline) ──
  const employeesQuery = useEmployeesQuery(isReady);

  // ── Bridge refs (track last-bridged data reference to avoid re-running on re-renders
  //    but still re-bridge when SSE invalidation triggers a refetch with new data) ──
  const lastCrmData = useRef<unknown>(undefined);
  const lastChangesData = useRef<unknown>(undefined);
  const lastRecruitmentData = useRef<unknown>(undefined);
  const lastSkillsCatalogData = useRef<unknown>(undefined);
  const lastEmployeesData = useRef<unknown>(undefined);

  // ── CRM config side-effects (no store bridge — consumers use useCrmData() directly) ──
  useEffect(() => {
    if (!crmQuery.data?.available || crmQuery.data === lastCrmData.current) return;
    lastCrmData.current = crmQuery.data;
    const crmData = crmQuery.data;

    // Pre-load cached logos (non-blocking)
    import("../components/common/AccountLogo").then((m) => m.loadLogoBulk()).catch(() => {});

    // Update STATUS_TEXT and STATUS_OPTIONS from OptionSets
    if (crmData.optionsets?.beOpportunitystatus) {
      const statusMap = crmData.optionsets.beOpportunitystatus;
      for (const [value, label] of Object.entries(statusMap)) {
        STATUS_TEXT[Number(value)] = label as string;
      }
      updateStatusOptionsFromOptionSet(statusMap as Record<number, string>);
    }

    // Apply config (MAGR mapping, categories, grade targets, etc.)
    if (crmData.config) {
      if (crmData.config.appSetting) {
        updateTuThresholds(crmData.config.appSetting);
        if (crmData.config.appSetting.mdsExtractStart) {
          updateMdsExtractStart(crmData.config.appSetting.mdsExtractStart);
        }
      }
      // Derive special segment codes from var_config.segment (codes where parent != code)
      if (crmData.config.segment) {
        const special: string[] = [];
        for (const [code, raw] of Object.entries(crmData.config.segment)) {
          try {
            const val = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (val.parent && val.parent !== code) special.push(code);
          } catch {
            /* skip */
          }
        }
        updateSpecialSegmentCodes(special);
      }
      applyGradeConfig(crmData.config);
      if (crmData.config.category) applyCategoryConfig(crmData.config.category);
      applyBrandConfig(crmData.config);
    }

    fLog("hydration", "CRM bridged to store");
  }, [crmQuery.data]);

  // ── Metadata: holidays side-effect only (employee metadata bridge removed — consumers use useMergedEmployeeData) ──
  useEffect(() => {
    if (!metadataQuery.data?.available) return;
    const meta = metadataQuery.data;
    if (Array.isArray(meta.holidays) && meta.holidays.length > 0) {
      updatePublicHolidays(meta.holidays.map((h: { date: string }) => h.date));
      fLog("hydration", `Holidays: ${meta.holidays.length} loaded`);
    }
  }, [metadataQuery.data]);

  // SAP, Skills, and Staffing bridges removed — consumers use facade hooks directly
  // (useSapData, useSkillsData, useStaffingData)

  // ── Bridge: Changes → restoreUserChanges ──
  useEffect(() => {
    if (!changesQuery.data || changesQuery.data === lastChangesData.current) return;
    lastChangesData.current = changesQuery.data;
    if (Object.keys(changesQuery.data).length > 0) {
      restoreUserChanges(changesQuery.data);
      // Update auto-save baseline so restored data isn't detected as dirty
      updateAutoSaveBaseline();
      fLog("hydration", "User changes restored");
    }
  }, [changesQuery.data]);

  // Recruitment, Skills catalog, Enriched employees bridges removed — consumers read queries directly.

  // ── Compute aggregate state (same interface as legacy hook) ──
  // Only count initial fetches (not background refetches triggered by SSE invalidation)
  const anyInitialFetching =
    (crmQuery.isFetching && !crmQuery.data) ||
    (staffingQuery.isFetching && !staffingQuery.data) ||
    (sapQuery.isFetching && !sapQuery.data) ||
    (metadataQuery.isFetching && !metadataQuery.data) ||
    (skillsQuery.isFetching && !skillsQuery.data) ||
    (changesQuery.isFetching && !changesQuery.data);
  const hydrating = filter !== null && (!changesQuery.isSuccess || !crmQuery.isSuccess || anyInitialFetching);
  const hydrated = changesQuery.isSuccess && crmQuery.isSuccess && !anyInitialFetching;
  const error = crmQuery.error?.message || staffingQuery.error?.message || changesQuery.error?.message || null;

  // Real download progress via ReadableStream byte counting
  const [hydrationPercent, setHydrationPercent] = useState(0);
  useEffect(() => {
    if (hydrating) {
      setHydrationProgressListener((received, total) => {
        const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
        setHydrationPercent(pct);
      });
    } else {
      setHydrationProgressListener(null);
      if (hydrated) setHydrationPercent(100);
    }
    return () => setHydrationProgressListener(null);
  }, [hydrating, hydrated]);

  // ── startHydration callback (called by LandingPage) ──
  const startHydration = useCallback((f?: HydrationFilter) => {
    useAppStore.getState().setHydrationFilter(f ?? {});
  }, []);

  // Regions from query
  const regions: RegionData[] = regionsQuery.data?.available ? (regionsQuery.data.regions ?? []) : [];

  return {
    hydrating,
    hydrated,
    backendAvailable,
    error,
    hydrationPercent,
    startHydration,
    regions,
    loadingRegions: regionsQuery.isFetching,
  };
}
