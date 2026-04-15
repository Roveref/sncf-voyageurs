/**
 * useSkillsCatalogData — Reads skills catalog from React Query cache.
 * Replaces useDataStore(s => s.skillsCatalog).
 */

import { useAppStore } from "../stores/useAppStore";
import { useHealthQuery } from "./useHealthQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useSkillsCatalogQuery } from "./useSkillsCatalogQuery";

export interface SkillsCatalogEntry {
  name: string;
  category: string | null;
  usageCount: number;
}

const EMPTY: SkillsCatalogEntry[] = [];

export function useSkillsCatalogData(): SkillsCatalogEntry[] {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true && hydrationFilter !== null;

  const query = useSkillsCatalogQuery(isReady);
  return (query.data?.skills as SkillsCatalogEntry[] | undefined) ?? EMPTY;
}
