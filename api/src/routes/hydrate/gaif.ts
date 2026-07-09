/**
 * Routes /api/hydrate/gaif — Hydratation des tables métier GAIF.
 *
 * Retourne en un seul bundle :
 *   - contracts (gaif_contracts)
 *   - projects (gaif_projects)
 *   - comites + comiteActions (gaif_comites + gaif_comite_actions)
 *   - risks (gaif_risks)
 *   - audits (gaif_audits)
 *   - doctrinaireDocs (gaif_doctrinaire_docs)
 *   - vrSchedule (gaif_vr_schedule)
 *
 * Les tables peuvent ne pas exister sur une vieille DB ; dans ce cas
 * la clé correspondante est un tableau vide.
 */

import { Router, Request, Response } from "express";
import db from "../../db/database.js";
import { error } from "../../utils/logger.js";

const router = Router();

function safeQueryAll<T>(sql: string): T[] {
  try {
    return db.prepare(sql).all() as T[];
  } catch {
    return [];
  }
}

/** Décode un champ TEXT contenant du JSON ; retourne la valeur par défaut si null ou invalide. */
function parseJson<T>(text: unknown, fallback: T): T {
  if (typeof text !== "string" || !text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// ── GET /api/hydrate/gaif ──

router.get("/gaif", (_req: Request, res: Response) => {
  try {
    const contractsRaw = safeQueryAll<{
      id: string;
      prestataire: string;
      patrimoine: string;
      scope: string | null;
      sites: string | null;
      startDate: string | null;
      endDate: string | null;
      amount: number | null;
      perfScore: number | null;
      managerId: string | null;
      status: string | null;
    }>(
      `SELECT id, prestataire, patrimoine, scope, sites, startDate, endDate, amount, perfScore, managerId, status
       FROM gaif_contracts ORDER BY endDate ASC`
    );
    const contracts = contractsRaw.map((c) => ({ ...c, sites: parseJson<string[]>(c.sites, []) }));

    const projectsRaw = safeQueryAll<{
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
      budgetByYear: string | null;
      description: string | null;
    }>(
      `SELECT id, name, patrimoine, siteId, phase, marqueur, leadId, startDate, endDate, budget, budgetByYear, description
       FROM gaif_projects ORDER BY startDate ASC`
    );
    const projects = projectsRaw.map((p) => ({
      ...p,
      budgetByYear: parseJson<Record<string, number>>(p.budgetByYear, {}),
    }));

    const comitesRaw = safeQueryAll<{
      id: string;
      label: string;
      shortLabel: string | null;
      cadence: string;
      coAnimateur: string | null;
      themes: string | null;
      raciLeadId: string | null;
      nextOccurrence: string;
      color: string | null;
    }>(
      `SELECT id, label, shortLabel, cadence, coAnimateur, themes, raciLeadId, nextOccurrence, color
       FROM gaif_comites ORDER BY nextOccurrence ASC`
    );
    const comites = comitesRaw.map((c) => ({ ...c, themes: parseJson<string[]>(c.themes, []) }));

    const comiteActions = safeQueryAll<{
      id: string;
      comiteId: string;
      description: string;
      ownerId: string | null;
      dueDate: string | null;
      priority: string | null;
      status: string | null;
      decisionDate: string | null;
      outcome: string | null;
    }>(
      `SELECT id, comiteId, description, ownerId, dueDate, priority, status, decisionDate, outcome
       FROM gaif_comite_actions ORDER BY dueDate ASC`
    );

    const risks = safeQueryAll<{
      id: string;
      title: string;
      description: string | null;
      kind: string;
      severity: string;
      stage: string;
      ownerId: string | null;
      processus: string | null;
      patrimoine: string | null;
      dueDate: string | null;
    }>(
      `SELECT id, title, description, kind, severity, stage, ownerId, processus, patrimoine, dueDate
       FROM gaif_risks ORDER BY severity DESC, dueDate ASC`
    );

    const audits = safeQueryAll<{
      id: string;
      kind: string;
      label: string;
      scope: string | null;
      plannedDate: string;
      completedDate: string | null;
      auditor: string | null;
      status: string;
      report: string | null;
    }>(
      `SELECT id, kind, label, scope, plannedDate, completedDate, auditor, status, report
       FROM gaif_audits ORDER BY plannedDate ASC`
    );

    const docsRaw = safeQueryAll<{
      id: string;
      title: string;
      category: string;
      version: string | null;
      lastUpdate: string | null;
      owner: string | null;
      status: string;
      summary: string | null;
      tags: string | null;
      url: string | null;
    }>(
      // Note : `content` est exclu pour éviter de transférer un gros payload ;
      // il est récupéré à la demande via l'agent IA (knowledge_base_lookup).
      `SELECT id, title, category, version, lastUpdate, owner, status, summary, tags, url
       FROM gaif_doctrinaire_docs ORDER BY category, lastUpdate DESC`
    );
    const doctrinaireDocs = docsRaw.map((d) => ({ ...d, tags: parseJson<string[]>(d.tags, []) }));

    const vrSchedule = safeQueryAll<{
      id: number;
      assetId: string;
      plannedDate: string;
      executedDate: string | null;
      vrType: string | null;
      status: string;
      inspector: string | null;
      result: string | null;
    }>(
      `SELECT id, assetId, plannedDate, executedDate, vrType, status, inspector, result
       FROM gaif_vr_schedule ORDER BY plannedDate DESC LIMIT 2000`
    );

    res.json({
      available: true,
      contracts,
      projects,
      comites,
      comiteActions,
      risks,
      audits,
      doctrinaireDocs,
      vrSchedule,
      counts: {
        contracts: contracts.length,
        projects: projects.length,
        comites: comites.length,
        comiteActions: comiteActions.length,
        risks: risks.length,
        audits: audits.length,
        doctrinaireDocs: doctrinaireDocs.length,
        vrSchedule: vrSchedule.length,
      },
    });
  } catch (err) {
    error("hydrate/gaif", "Error:", err);
    res.status(500).json({ error: "Error fetching GAIF data." });
  }
});

export default router;
