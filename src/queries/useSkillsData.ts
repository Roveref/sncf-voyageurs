/**
 * useSkillsData — Facade hook that reads skills data from React Query cache directly.
 * Replaces the bridge pattern: useSkillsQuery → useHydration bridge → useDataStore.hydratedSkillsData.
 *
 * Performs the same transformations as the old bridge:
 * - skills: Object → Map<string, EmployeeSkills>
 * - skillIndex: Object → Map<string, Set<string>>
 */

import { useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import { useHealthQuery } from "./useHealthQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useSkillsQuery } from "./useSkillsQuery";
import type { EmployeeSkills } from "../components/StaffingTab/types";
import type { HydratedSkillsData } from "../stores/useComputedStore";

export function useSkillsData() {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true && hydrationFilter !== null;

  const query = useSkillsQuery(isReady);
  const data = query.data;

  const skillsData = useMemo<HydratedSkillsData | null>(() => {
    if (!data?.available) return null;
    const raw = data.skillsData;

    const skillsMap = new Map(Object.entries(raw.profiles)) as Map<string, EmployeeSkills>;

    const skillIndexMap = new Map<string, Set<string>>();
    for (const [skill, empIds] of Object.entries(raw.catalog.skillIndex as Record<string, string[]>)) {
      skillIndexMap.set(skill, new Set(empIds));
    }

    return {
      skills: skillsMap,
      catalog: {
        allSkills: raw.catalog.allSkills,
        categories: raw.catalog.categories,
        skillIndex: skillIndexMap,
      },
      totalEmployees: raw.totalEmployees,
      totalSkills: raw.totalSkills,
    };
  }, [data]);

  return {
    skillsData,
    isReady: query.isSuccess,
    isLoading: query.isLoading,
  };
}
