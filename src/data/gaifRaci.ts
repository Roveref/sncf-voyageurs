/**
 * RACI des processus de gestion d'actifs GAIF.
 * Source : Prescription "Processus, Gouvernance et Comitologie" Transilien.
 */

export type RaciRole = "R" | "A" | "C" | "I" | "";

export interface RaciProcess {
  key: string;
  label: string;
  phase: "Pilotage" | "Cycle de vie" | "Amélioration continue" | "Gestion documentaire";
}

export const RACI_PROCESSES: RaciProcess[] = [
  { key: "suivi_indicateurs", label: "Suivi des indicateurs", phase: "Pilotage" },
  { key: "maj_psga", label: "Mise à jour PSGA", phase: "Pilotage" },
  { key: "gestion_budget", label: "Gestion budget actifs", phase: "Pilotage" },
  { key: "analyse_besoin", label: "Analyse du besoin", phase: "Cycle de vie" },
  { key: "maj_strategie_cdv", label: "Mise à jour stratégie cycle de vie", phase: "Cycle de vie" },
  { key: "exploitation", label: "Exploitation de l'actif", phase: "Cycle de vie" },
  { key: "audit_sga", label: "Audit du système GA", phase: "Amélioration continue" },
  { key: "gestion_nc", label: "Gestion non-conformités", phase: "Amélioration continue" },
  { key: "actions_mep", label: "Actions mise en œuvre", phase: "Amélioration continue" },
  { key: "strategie_doc", label: "Stratégie documentaire", phase: "Gestion documentaire" },
  { key: "mep_doc", label: "Mise en œuvre stratégie doc", phase: "Gestion documentaire" },
];

export const RACI_STAKEHOLDERS = [
  "Dir. GAIF",
  "Resp. Pat.",
  "CoPat TM",
  "Mainteneur",
  "IDFM",
  "DG TN",
  "Strat. & Dev",
  "DET",
  "Dir. lignes",
  "A2IF",
];

// Matrix[process_key][stakeholder_index] = role
export const RACI_MATRIX: Record<string, RaciRole[]> = {
  suivi_indicateurs: ["A", "R", "C", "I", "", "I", "I", "I", "I", ""],
  maj_psga: ["R", "C", "I", "I", "", "A", "I", "I", "I", "I"],
  gestion_budget: ["R", "C", "", "", "", "A", "I", "I", "C", "C"],
  analyse_besoin: ["R", "C", "C", "", "", "A", "C", "C", "C", ""],
  maj_strategie_cdv: ["C", "C", "R", "C", "", "A", "C", "C", "", ""],
  exploitation: ["I", "I", "C", "C", "", "", "", "A", "I", ""],
  audit_sga: ["R", "C", "C", "I", "I", "A", "I", "A", "I", ""],
  gestion_nc: ["I", "I", "R", "I", "", "I", "I", "A", "I", ""],
  actions_mep: ["I", "I", "R", "C", "I", "I", "I", "I", "I", ""],
  strategie_doc: ["R", "C", "I", "I", "", "A", "I", "I", "I", ""],
  mep_doc: ["I", "I", "R", "C", "", "", "", "I", "", ""],
};

export const RACI_COLORS: Record<RaciRole, string> = {
  R: "#EB0070",
  A: "#7C3AED",
  C: "#0EA5E9",
  I: "#94A3B8",
  "": "transparent",
};

export const RACI_LABELS: Record<RaciRole, string> = {
  R: "Responsible (réalise)",
  A: "Accountable (valide)",
  C: "Consulted (consulté)",
  I: "Informed (informé)",
  "": "—",
};

// ─────────────────────────────────────────────────────────────────────────────
// RACI #2 — Parties prenantes × activités GAIF
// Source : Note Parties Prenantes Transilien (figures 2 et 3).
// Le référentiel #2 est centré sur les interactions entre parties prenantes,
// alors que RACI_MATRIX (ci-dessus) est centré sur les processus PSGA.
// ─────────────────────────────────────────────────────────────────────────────

export interface StakeholderActivity {
  key: string;
  label: string;
  group: "Fonctionnelle" | "ISO 55001";
}

export const STAKEHOLDER_ACTIVITIES: StakeholderActivity[] = [
  { key: "pilotage_perf", label: "Pilotage & analyse de performance", group: "Fonctionnelle" },
  { key: "cycle_vie", label: "Gestion cycle de vie", group: "Fonctionnelle" },
  { key: "exploitation", label: "Gestion de l'exploitation", group: "Fonctionnelle" },
  { key: "maintenance", label: "Gestion de la maintenance", group: "Fonctionnelle" },
  { key: "documentation", label: "Gestion de la documentation", group: "Fonctionnelle" },
  { key: "logistique", label: "Logistique", group: "Fonctionnelle" },
  { key: "achat", label: "Achat", group: "Fonctionnelle" },
  { key: "financier", label: "Financier", group: "Fonctionnelle" },
  { key: "rh", label: "RH", group: "Fonctionnelle" },
  { key: "prescription", label: "Prescription", group: "Fonctionnelle" },
  { key: "audit_interne", label: "Audit interne", group: "Fonctionnelle" },
  { key: "externalisation", label: "Gestion externalisation", group: "Fonctionnelle" },
];

export const STAKEHOLDER_COLUMNS = ["IDFM", "DG TN", "TN GAIF", "Dir. lignes", "Technicentre", "Prestataire"];

// Matrix[activity_key][stakeholder_index] = role
export const STAKEHOLDER_MATRIX: Record<string, RaciRole[]> = {
  pilotage_perf: ["A", "A", "R", "C", "C", "I"],
  cycle_vie: ["A", "A", "R", "C", "C", "I"],
  exploitation: ["I", "A", "A", "C", "R", "I"],
  maintenance: ["", "", "A", "A", "R", "C"],
  documentation: ["C", "I", "A", "A", "R", "I"],
  logistique: ["", "I", "A", "A", "R", "I"],
  achat: ["I", "A", "A", "A", "C", "I"],
  financier: ["A", "A", "A", "C", "C", ""],
  rh: ["A", "A", "A", "R", "C", "I"],
  prescription: ["", "I", "A", "I", "C", "I"],
  audit_interne: ["I", "I", "R", "A", "C", "I"],
  externalisation: ["I", "C", "A", "A", "C", "I"],
};
