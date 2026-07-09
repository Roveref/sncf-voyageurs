/**
 * useStaffingIndex — Build a jobNo → [assignments] map from staffing records.
 *
 * Pré-refonte : l'index était construit dans useStaffingEffects au moment où
 * le StaffingTab se montait, puis stocké dans localStorage. Résultat : les
 * details cards d'un actif ne montraient pas le staffing tant que l'utilisateur
 * n'avait pas visité l'onglet Plan de charge.
 *
 * Nouvelle approche : l'index est dérivé directement des données staffing
 * React Query, disponible dès la fin de l'hydratation.
 */

import { useMemo } from "react";
import { useStaffingData } from "./useStaffingData";
import type { StaffingRecord } from "../components/StaffingTab/types";

export interface StaffingIndexEntry {
  empId: string;
  name: string;
  grade: string;
  utilization: number;
  startDate: string;
  endDate: string;
  status?: string;
  jobName: string;
  category?: string;
}

export type StaffingIndex = Record<string, StaffingIndexEntry[]>;

function formatName(r: StaffingRecord): string {
  const first = r.firstName || "";
  const last = r.lastName || "";
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed || r.empId;
}

function normalizeDate(d: string | undefined): string {
  if (!d) return "";
  if (d.length === 10) return d; // YYYY-MM-DD
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toISOString().slice(0, 10);
}

/**
 * Renvoie un index `jobNo → assignments[]` construit depuis les records staffing.
 * Mémoïsé sur la référence `records` (stable via React Query cache).
 */
export function useStaffingIndex(): StaffingIndex {
  const { records } = useStaffingData();

  return useMemo(() => {
    if (!records || records.length === 0) return {};
    const index: StaffingIndex = {};
    for (const r of records) {
      if (!r.jobNo) continue;
      const key = String(r.jobNo).trim();
      if (!key) continue;
      if (!index[key]) index[key] = [];
      // Dedupe par empId pour un même jobNo
      if (index[key].some((e) => e.empId === r.empId)) continue;
      index[key].push({
        empId: r.empId,
        name: formatName(r),
        grade: r.grade || "",
        utilization: r.utilization ?? 0,
        startDate: normalizeDate(r.startDate),
        endDate: normalizeDate(r.endDate),
        status: r.status,
        jobName: r.jobName || "",
        category: r.category,
      });
    }
    return index;
  }, [records]);
}

/** Récupère les affectations pour un actif donné, via jobCode + opportunityId. */
export function lookupStaffingForAsset(
  index: StaffingIndex,
  opportunityId: string | undefined,
  jobCode: string | undefined
): StaffingIndexEntry[] {
  const keys: string[] = [];
  if (jobCode) keys.push(String(jobCode).trim());
  if (opportunityId) keys.push(String(opportunityId).trim());
  const seen = new Set<string>();
  const results: StaffingIndexEntry[] = [];
  for (const key of keys) {
    const entries = index[key];
    if (!entries) continue;
    for (const e of entries) {
      if (seen.has(e.empId)) continue;
      seen.add(e.empId);
      results.push(e);
    }
  }
  return results;
}
