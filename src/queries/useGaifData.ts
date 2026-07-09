/**
 * useGaifData — Facade hook that reads GAIF metier bundle from React Query cache.
 *
 * Single entry point for widgets and tabs to access :
 *   - contracts (gaif_contracts)
 *   - projects (gaif_projects)
 *   - comites + comiteActions
 *   - risks
 *   - audits
 *   - doctrinaireDocs
 *   - vrSchedule
 *
 * Remplace l'usage des constantes statiques en src/data/gaif*.ts pour les widgets.
 * Les fichiers `src/data/gaif*.ts` restent utiles comme fallback hors-ligne et
 * pour l'UI statique (enums, couleurs, labels).
 */

import { useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import { useHealthQuery } from "./useHealthQuery";
import { useReadyQuery } from "./useReadyQuery";
import { useGaifQuery } from "./useGaifQuery";

// ─────────────────────────────────────────────────────────────────────────────
// Types côté frontend (miroir des types backend hydrate/gaif.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface GaifContract {
  id: string;
  prestataire: string;
  patrimoine: string;
  scope: string | null;
  sites: string[];
  startDate: string | null;
  endDate: string | null;
  amount: number | null;
  perfScore: number | null;
  managerId: string | null;
  status: string | null;
}

export interface GaifProject {
  id: string;
  name: string;
  patrimoine: string | null;
  siteId: string | null;
  phase: number | null;
  marqueur: string | null;
  leadId: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  budgetByYear: Record<string, number>;
  description: string | null;
}

export interface GaifComite {
  id: string;
  label: string;
  shortLabel: string | null;
  cadence: string;
  coAnimateur: string | null;
  themes: string[];
  raciLeadId: string | null;
  nextOccurrence: string;
  color: string | null;
}

export interface GaifComiteAction {
  id: string;
  comiteId: string;
  description: string;
  ownerId: string | null;
  dueDate: string | null;
  priority: string | null;
  status: string | null;
  decisionDate: string | null;
  outcome: string | null;
}

export interface GaifRisk {
  id: string;
  title: string;
  description: string | null;
  kind: "risque" | "opportunite";
  severity: "critique" | "majeur" | "modere" | "mineur";
  stage: "identifie" | "evalue" | "plan_mitigation" | "cloture";
  ownerId: string | null;
  processus: string | null;
  patrimoine: string | null;
  dueDate: string | null;
}

export interface GaifAudit {
  id: string;
  kind: "audit_interne" | "revue_direction" | "pre_audit" | "certification";
  label: string;
  scope: string | null;
  plannedDate: string;
  completedDate: string | null;
  auditor: string | null;
  status: "planifie" | "en_cours" | "realise";
  report: string | null;
}

export interface GaifDoc {
  id: string;
  title: string;
  category: string;
  version: string | null;
  lastUpdate: string | null;
  owner: string | null;
  status: string;
  summary: string | null;
  tags: string[];
  url: string | null;
}

export interface GaifVrScheduleEntry {
  id: number;
  assetId: string;
  plannedDate: string;
  executedDate: string | null;
  vrType: string | null;
  status: string;
  inspector: string | null;
  result: string | null;
}

const EMPTY = {
  contracts: [] as GaifContract[],
  projects: [] as GaifProject[],
  comites: [] as GaifComite[],
  comiteActions: [] as GaifComiteAction[],
  risks: [] as GaifRisk[],
  audits: [] as GaifAudit[],
  doctrinaireDocs: [] as GaifDoc[],
  vrSchedule: [] as GaifVrScheduleEntry[],
};

export function useGaifData() {
  const hydrationFilter = useAppStore((s) => s.hydrationFilter);
  const healthQuery = useHealthQuery();
  const backendAvailable = healthQuery.data === true;
  const readyQuery = useReadyQuery(backendAvailable);
  const isReady = readyQuery.data?.ready === true && hydrationFilter !== null;

  const query = useGaifQuery(isReady);
  const data = query.data;

  const bundle = useMemo(() => {
    if (!data?.available) return EMPTY;
    return {
      contracts: (data.contracts ?? []) as GaifContract[],
      projects: (data.projects ?? []) as GaifProject[],
      comites: (data.comites ?? []) as GaifComite[],
      comiteActions: (data.comiteActions ?? []) as GaifComiteAction[],
      risks: (data.risks ?? []) as GaifRisk[],
      audits: (data.audits ?? []) as GaifAudit[],
      doctrinaireDocs: (data.doctrinaireDocs ?? []) as GaifDoc[],
      vrSchedule: (data.vrSchedule ?? []) as GaifVrScheduleEntry[],
    };
  }, [data]);

  return {
    ...bundle,
    isReady: query.isSuccess,
    isLoading: query.isLoading,
    hasGaifData: !!data?.available,
  };
}
